# part 3 - responders vs non-responders (melanoma, miraclib, PBMC)
#
# every subject has 3 samples (day 0/7/14) so the samples arent independent.
# main test is a mixed model per population w/ a random intercept per subject:
#     percentage ~ responder + C(time) + (1 | subject)
# p-values get BH corrected across the 5 populations.
# mann-whitney on per subject means is there as a nonparametric check.
import sqlite3
import warnings

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from scipy import stats
from statsmodels.stats.multitest import multipletests

ALPHA = 0.05


def get_subset(conn: sqlite3.Connection) -> pd.DataFrame:
    df = pd.read_sql(
        """
        SELECT f.sample, s.subject_id, s.time_from_treatment_start AS time,
               sub.response, f.population, f.percentage
        FROM sample_frequencies f
        JOIN samples s ON s.sample_id = f.sample
        JOIN subjects sub USING (subject_id)
        WHERE sub.condition = 'melanoma'
          AND sub.treatment = 'miraclib'
          AND s.sample_type = 'PBMC'
          AND sub.response IS NOT NULL
        """,
        conn,
    )
    df["responder"] = (df["response"] == "yes").astype(int)
    return df


def fit_population(df: pd.DataFrame):
    model = smf.mixedlm("percentage ~ responder + C(time)", df, groups=df["subject_id"])
    # statsmodels warns when the subject variance ends up at 0 (boundary).
    # thats a real result here not an error, we flag it w/ re_singular instead
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return model.fit(reml=True)


def run_stats(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    results, diagnostics = [], []

    for pop, d in df.groupby("population"):
        print(f"  fitting {pop}...", flush=True)
        fit = fit_population(d)
        lo, hi = fit.conf_int().loc["responder"]

        # icc = how much of the variance is between subjects
        subj_var = float(fit.cov_re.iloc[0, 0])
        icc = subj_var / (subj_var + fit.scale)

        # cross check on per subject means
        means = d.groupby(["subject_id", "response"], as_index=False)["percentage"].mean()
        mwu = stats.mannwhitneyu(
            means.loc[means.response == "yes", "percentage"],
            means.loc[means.response == "no", "percentage"],
            alternative="two-sided",
        )

        results.append({
            "population": pop,
            "mean_responders": d.loc[d.responder == 1, "percentage"].mean(),
            "mean_non_responders": d.loc[d.responder == 0, "percentage"].mean(),
            "estimate": fit.params["responder"],
            "ci_low": lo,
            "ci_high": hi,
            "p_value": fit.pvalues["responder"],
            "icc": icc,
            "re_singular": subj_var < 1e-6,
            "mwu_p_value": mwu.pvalue,
            "n_subjects": d.subject_id.nunique(),
            "n_samples": len(d),
        })

        # stuff for the qq + residuals vs fitted plots
        resid = fit.resid.to_numpy()
        order = np.argsort(resid)
        theo = np.empty_like(resid)
        theo[order] = stats.norm.ppf((np.arange(1, len(resid) + 1) - 0.5) / len(resid))
        diagnostics.append(pd.DataFrame({
            "population": pop,
            "sample": d["sample"].to_numpy(),
            "fitted": fit.fittedvalues.to_numpy(),
            "residual": resid,
            "theoretical_quantile": theo,
        }))

    res = pd.DataFrame(results)
    res["q_value"] = multipletests(res["p_value"], method="fdr_bh")[1]
    res["mwu_q_value"] = multipletests(res["mwu_p_value"], method="fdr_bh")[1]
    res["significant"] = res["q_value"] < ALPHA
    res = res.sort_values("q_value").reset_index(drop=True)
    return res, pd.concat(diagnostics, ignore_index=True)

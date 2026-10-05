# Loblaw Bio: Miraclib Trial Analysis

Pipeline + dashboard for the Teiko cell-count take-home. Loads `cell-count.csv` into SQLite, computes per-sample cell population frequencies, compares responders vs non-responders, and summarizes the baseline subset.

## Running it (GitHub Codespaces)

The repo has a `.devcontainer` (Python 3.12 + Node 22) so a new Codespace has everything needed. From the repo root:

```bash
make setup      # pip install -r requirements.txt, then npm ci + npm run build for the dashboard
make pipeline   # builds teiko.db and runs parts 2-4 (about a minute)
make dashboard  # serves the dashboard on port 8000
```

**Dashboard link:** http://localhost:8000

In Codespaces port 8000 is forwarded automatically. Click "Open in Browser" on the popup, or open it from the Ports tab.

`make test` runs a few sanity checks (row counts, percentages sum to 100, part 4 counts match a pandas recompute).

### Running locally

Same three commands. Needs Python 3.11+ and Node 20.19+ (or 22.12+). On Windows `make` isn't installed by default, so either use Git Bash with make (`winget install ezwinports.make`) or run the commands from the Makefile directly.

## What the pipeline produces

`make pipeline` runs `pipeline.py`, which:

1. runs `load_data.py` (part 1), which rebuilds `teiko.db` from the csv
2. writes the results back into the db (the dashboard reads from there) and into `outputs/` as csv

| Output | Part | Contents |
|---|---|---|
| `sample_frequencies` (view), `outputs/frequencies.csv` | 2 | sample, total_count, population, count, percentage |
| `stats_results`, `outputs/stats_results.csv` | 3 | per population: group means, mixed model estimate + 95% CI, p, BH q, Mann-Whitney check |
| `stats_diagnostics` | 3 | fitted values + residuals for the diagnostic plots |
| `outputs/baseline_samples.csv` | 4 | every sample in the baseline subset |
| `baseline_counts`, `outputs/baseline_counts.csv` | 4 | samples per project, subjects by response, subjects by sex |
| `answers` | 4 | the B cell average |

`load_data.py` can also be run on its own (`python load_data.py`, no arguments) and creates `teiko.db` in the repo root.

## Database schema

```
projects     (project_id)
  -> subjects    (subject_id, project_id, condition, age, sex, treatment, response)
    -> samples     (sample_id, subject_id, sample_type, time_from_treatment_start)
      -> cell_counts (sample_id, population, count)

each arrow is one-to-many
```

- **Subject info is stored once.** In the csv, condition/age/sex/treatment/response repeat on every sample row for a subject. I checked they never differ within a subject (the loader raises if they do), so they live in `subjects` and samples just point to their subject. No duplicated data, and nothing can get out of sync.
- **Cell counts are long format** (one row per sample + population) instead of one column per population. Adding a new population is just more rows, no schema change, and queries like "frequency of every population" are a plain `GROUP BY` / window function instead of unpivoting columns. The part 2 table is a SQL view (`sample_frequencies`) built this way.
- **Constraints and indexes.** Foreign keys, `CHECK`s on sex/response/counts, and a composite primary key on `(sample_id, population)`. Indexes cover the columns analyses filter on (condition, treatment, response, sex, sample type, timepoint).

**Scaling.** With hundreds of projects and thousands of samples, the shape stays the same, the tables just get taller. New projects or samples are inserts, not schema changes, and the indexes keep the common filters fast. New kinds of metadata (e.g. sample collection site, assay batch) would be new columns or tables joined on `sample_id`/`subject_id`. Past what SQLite handles comfortably, the same schema moves to Postgres as is, and `cell_counts` is the table you'd partition (by project) if it got really big.

## Code structure

```
load_data.py          part 1: csv -> teiko.db (schema + load)
pipeline.py           runs everything in order, writes tables + outputs/
analysis/
  db.py               db path + connection helper
  frequencies.py      part 2
  stats.py            part 3 (mixed models, BH, Mann-Whitney, diagnostics)
  subset.py           part 4 (baseline subset counts, B cell average)
api/main.py           FastAPI: read-only JSON endpoints + serves the built frontend
frontend/             React + Vite + TypeScript + Tailwind + shadcn/ui
tests/                pytest checks
.devcontainer/        Codespaces config
```

The analysis is plain SQL + pandas so each part can be read top to bottom. The dashboard is one server: FastAPI serves `/api/*` from the db and the built React app from `frontend/dist`, so `make dashboard` is just uvicorn.

## Part 3: responders vs non-responders

Subset: melanoma patients on miraclib, PBMC samples only (656 subjects, 1968 samples, each subject sampled at day 0, 7 and 14).

**Method.** Each subject has 3 samples, so the samples aren't independent and a t-test or Mann-Whitney on all 1968 would overcount. For each population I fit a linear mixed model

```
percentage ~ responder + C(time) + (1 | subject)
```

and tested the responder coefficient (difference in percentage points between responders and non-responders) with a Wald test. P-values are adjusted across the 5 populations with Benjamini-Hochberg (q-values, significant at q < 0.05). As a nonparametric check, I also ran Mann-Whitney U on each subject's mean across the 3 timepoints (one value per subject), with the same BH adjustment. Residual QQ and residual vs fitted plots are on the dashboard.

**Results.**

| Population | Difference (pts) | 95% CI | q (BH) | Mann-Whitney q |
|---|---|---|---|---|
| CD4 T cells | +0.64 | 0.19 to 1.08 | 0.025 | 0.062 |
| B cells | -0.20 | -0.48 to 0.09 | 0.321 | 0.432 |
| NK cells | -0.23 | -0.58 to 0.12 | 0.321 | 0.317 |
| Monocytes | -0.14 | -0.53 to 0.24 | 0.583 | 0.432 |
| CD8 T cells | -0.06 | -0.48 to 0.35 | 0.769 | 0.622 |

**CD4 T cells are the only population with a significant difference**: responders have slightly higher relative CD4 frequency. The effect is small (under 1 percentage point) and the Mann-Whitney check is borderline, so I'd call it a modest signal, not a strong one.

**Notes / caveats.**
- The random intercept variance came out ~0 for every population (ICC ≈ 0): a subject's 3 samples aren't more alike than samples from different people. So the mixed model gives basically the same answer as plain regression here. I kept it because it's the right model for the design and the conclusion doesn't change.
- Random intercepts only. 3 timepoints is too few for random slopes.
- Project isn't in the model.
- Percentages are compositional (sum to 100), so the 5 tests aren't fully independent.
- This is association, not prediction. To predict response you'd want a classifier evaluated on held out patients.

## Part 4: baseline subset

Melanoma, miraclib, PBMC, time 0: **656 samples** (one per subject).

| | |
|---|---|
| Samples per project | prj1: 384, prj3: 272 |
| Subjects by response | responders: 331, non-responders: 325 |
| Subjects by sex | male: 344, female: 312 |

prj2 doesn't show up because all its samples are whole blood, not PBMC.

**Average B cells for melanoma males, responders, time 0 (all sample types and treatments): 10206.15** (485 samples).

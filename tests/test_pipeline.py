# checks the db against the raw csv using pandas (separate from the sql)
# needs `make pipeline` to have run first
import pandas as pd
import pytest

from analysis.db import ROOT, connect
from analysis.frequencies import get_frequencies
from analysis.subset import avg_b_cell_male_responders, baseline_counts

POPS = ["b_cell", "cd8_t_cell", "cd4_t_cell", "nk_cell", "monocyte"]


@pytest.fixture(scope="module")
def raw():
    return pd.read_csv(ROOT / "cell-count.csv")


@pytest.fixture(scope="module")
def conn():
    c = connect()
    yield c
    c.close()


def test_row_counts(conn, raw):
    assert conn.execute("SELECT COUNT(*) FROM samples").fetchone()[0] == len(raw)
    assert conn.execute("SELECT COUNT(*) FROM cell_counts").fetchone()[0] == len(raw) * 5
    assert conn.execute("SELECT COUNT(*) FROM subjects").fetchone()[0] == raw.subject.nunique()


def test_percentages_sum_to_100(conn):
    freq = get_frequencies(conn)
    sums = freq.groupby("sample").percentage.sum()
    assert (sums - 100).abs().max() < 1e-9


def test_frequencies_match_csv(conn, raw):
    freq = get_frequencies(conn).set_index(["sample", "population"])
    long = raw.melt(id_vars="sample", value_vars=POPS, var_name="population", value_name="count")
    long["pct"] = 100 * long["count"] / long.groupby("sample")["count"].transform("sum")
    long = long.set_index(["sample", "population"]).loc[freq.index]
    assert (long["count"] == freq["count"]).all()
    assert (long["pct"] - freq["percentage"]).abs().max() < 1e-9


def test_baseline_counts(conn, raw):
    base = raw[(raw.condition == "melanoma") & (raw.treatment == "miraclib")
               & (raw.sample_type == "PBMC") & (raw.time_from_treatment_start == 0)]
    got = {(r.grouping, r.label): r.n for r in baseline_counts(conn).itertuples()}
    expected = {}
    for k, v in base.groupby("project").size().items():
        expected[("project", k)] = v
    for k, v in base.groupby("response").subject.nunique().items():
        expected[("response", k)] = v
    for k, v in base.groupby("sex").subject.nunique().items():
        expected[("sex", k)] = v
    assert got == expected


def test_b_cell_answer(conn, raw):
    m = raw[(raw.condition == "melanoma") & (raw.sex == "M") & (raw.response == "yes")
            & (raw.time_from_treatment_start == 0)]
    assert avg_b_cell_male_responders(conn) == round(m.b_cell.mean(), 2)

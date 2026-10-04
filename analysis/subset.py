# part 4 - melanoma pbmc baseline samples from miraclib patients
import sqlite3

import pandas as pd

BASELINE_FILTER = """
    sub.condition = 'melanoma'
    AND sub.treatment = 'miraclib'
    AND s.sample_type = 'PBMC'
    AND s.time_from_treatment_start = 0
"""


def baseline_samples(conn: sqlite3.Connection) -> pd.DataFrame:
    return pd.read_sql(
        f"""
        SELECT s.sample_id, s.subject_id, sub.project_id, sub.response, sub.sex
        FROM samples s
        JOIN subjects sub USING (subject_id)
        WHERE {BASELINE_FILTER}
        ORDER BY s.sample_id
        """,
        conn,
    )


def baseline_counts(conn: sqlite3.Connection) -> pd.DataFrame:
    # samples per project, subjects (distinct) per response and sex
    return pd.read_sql(
        f"""
        SELECT 'project' AS grouping, sub.project_id AS label, COUNT(*) AS n
        FROM samples s JOIN subjects sub USING (subject_id)
        WHERE {BASELINE_FILTER}
        GROUP BY sub.project_id

        UNION ALL
        SELECT 'response', sub.response, COUNT(DISTINCT sub.subject_id)
        FROM samples s JOIN subjects sub USING (subject_id)
        WHERE {BASELINE_FILTER}
        GROUP BY sub.response

        UNION ALL
        SELECT 'sex', sub.sex, COUNT(DISTINCT sub.subject_id)
        FROM samples s JOIN subjects sub USING (subject_id)
        WHERE {BASELINE_FILTER}
        GROUP BY sub.sex

        ORDER BY grouping, label
        """,
        conn,
    )


def avg_b_cell_male_responders(conn: sqlite3.Connection) -> float:
    # melanoma males, responders, time 0, any sample type / treatment
    (avg,) = conn.execute(
        """
        SELECT AVG(c.count)
        FROM cell_counts c
        JOIN samples s USING (sample_id)
        JOIN subjects sub USING (subject_id)
        WHERE c.population = 'b_cell'
          AND sub.condition = 'melanoma'
          AND sub.sex = 'M'
          AND sub.response = 'yes'
          AND s.time_from_treatment_start = 0
        """
    ).fetchone()
    return round(avg, 2)

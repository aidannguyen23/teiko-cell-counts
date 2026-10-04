# part 1 - loads cell-count.csv into teiko.db
# just run: python load_data.py  (rebuilds the db every time)

import csv
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "cell-count.csv"
DB_PATH = ROOT / "teiko.db"

POPULATIONS = ["b_cell", "cd8_t_cell", "cd4_t_cell", "nk_cell", "monocyte"]

SCHEMA = """
DROP VIEW  IF EXISTS sample_frequencies;
DROP TABLE IF EXISTS cell_counts;
DROP TABLE IF EXISTS samples;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS projects;

CREATE TABLE projects (
    project_id TEXT PRIMARY KEY
);

-- subject info doesnt change between samples so its stored once here
CREATE TABLE subjects (
    subject_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(project_id),
    condition  TEXT NOT NULL,
    age        INTEGER,
    sex        TEXT CHECK (sex IN ('M', 'F')),
    treatment  TEXT NOT NULL,
    response   TEXT CHECK (response IN ('yes', 'no'))  -- null for healthy
);

-- each subject has multiple samples (diff timepoints)
CREATE TABLE samples (
    sample_id                 TEXT PRIMARY KEY,
    subject_id                TEXT NOT NULL REFERENCES subjects(subject_id),
    sample_type               TEXT NOT NULL,
    time_from_treatment_start INTEGER NOT NULL
);

-- long format so adding a new population is just more rows
CREATE TABLE cell_counts (
    sample_id  TEXT NOT NULL REFERENCES samples(sample_id),
    population TEXT NOT NULL,
    count      INTEGER NOT NULL CHECK (count >= 0),
    PRIMARY KEY (sample_id, population)
);

CREATE INDEX idx_subjects_filters ON subjects(condition, treatment, response, sex);
CREATE INDEX idx_samples_subject  ON samples(subject_id);
CREATE INDEX idx_samples_filters  ON samples(sample_type, time_from_treatment_start);

-- part 2 table
CREATE VIEW sample_frequencies AS
SELECT
    sample_id                                                 AS sample,
    SUM(count) OVER (PARTITION BY sample_id)                  AS total_count,
    population,
    count,
    100.0 * count / SUM(count) OVER (PARTITION BY sample_id)  AS percentage
FROM cell_counts;
"""


def main(csv_path: Path = CSV_PATH, db_path: Path = DB_PATH) -> None:
    with open(csv_path, newline="") as f:
        rows = list(csv.DictReader(f))

    projects, subjects, samples, counts = set(), {}, [], []
    for r in rows:
        projects.add(r["project"])
        subject = (
            r["subject"], r["project"], r["condition"], int(r["age"]),
            r["sex"], r["treatment"], r["response"] or None,
        )
        # make sure subject info is actually the same across their rows
        if subjects.setdefault(r["subject"], subject) != subject:
            raise ValueError(f"Inconsistent attributes for subject {r['subject']}")
        samples.append((
            r["sample"], r["subject"], r["sample_type"], int(r["time_from_treatment_start"]),
        ))
        counts.extend((r["sample"], pop, int(r[pop])) for pop in POPULATIONS)

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(SCHEMA)
        with conn:
            conn.executemany("INSERT INTO projects VALUES (?)", [(p,) for p in sorted(projects)])
            conn.executemany("INSERT INTO subjects VALUES (?, ?, ?, ?, ?, ?, ?)", subjects.values())
            conn.executemany("INSERT INTO samples VALUES (?, ?, ?, ?)", samples)
            conn.executemany("INSERT INTO cell_counts VALUES (?, ?, ?)", counts)
    finally:
        conn.close()

    print(
        f"Loaded {len(projects)} projects, {len(subjects)} subjects, "
        f"{len(samples)} samples, {len(counts)} cell counts into {db_path.name}"
    )


if __name__ == "__main__":
    main()

# part 2 - relative freq of each population per sample
import sqlite3

import pandas as pd


def get_frequencies(conn: sqlite3.Connection) -> pd.DataFrame:
    return pd.read_sql(
        "SELECT sample, total_count, population, count, percentage "
        "FROM sample_frequencies ORDER BY sample, population",
        conn,
    )

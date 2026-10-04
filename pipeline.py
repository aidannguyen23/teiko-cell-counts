# runs everything: load db -> part 2 -> part 3 -> part 4
# results get written back into teiko.db (for the dashboard) and to outputs/ as csv
import load_data
from analysis.db import OUTPUT_DIR, connect
from analysis.frequencies import get_frequencies
from analysis.stats import get_subset, run_stats
from analysis.subset import avg_b_cell_male_responders, baseline_counts, baseline_samples


def main() -> None:
    load_data.main()
    OUTPUT_DIR.mkdir(exist_ok=True)
    conn = connect()

    try:
        print("\npart 2: frequencies")
        freq = get_frequencies(conn)
        freq.to_csv(OUTPUT_DIR / "frequencies.csv", index=False)
        print(f"  {len(freq)} rows -> outputs/frequencies.csv")

        print("\npart 3: responders vs non-responders")
        results, diagnostics = run_stats(get_subset(conn))
        results.to_sql("stats_results", conn, if_exists="replace", index=False)
        diagnostics.to_sql("stats_diagnostics", conn, if_exists="replace", index=False)
        results.to_csv(OUTPUT_DIR / "stats_results.csv", index=False)
        cols = ["population", "estimate", "ci_low", "ci_high", "p_value", "q_value", "mwu_q_value", "significant"]
        print(results[cols].round(4).to_string(index=False))

        print("\npart 4: baseline melanoma PBMC, miraclib")
        baseline_samples(conn).to_csv(OUTPUT_DIR / "baseline_samples.csv", index=False)
        counts = baseline_counts(conn)
        counts.to_sql("baseline_counts", conn, if_exists="replace", index=False)
        counts.to_csv(OUTPUT_DIR / "baseline_counts.csv", index=False)
        print(counts.to_string(index=False))

        b_cell = avg_b_cell_male_responders(conn)
        conn.execute("DROP TABLE IF EXISTS answers")
        conn.execute("CREATE TABLE answers (question TEXT PRIMARY KEY, value REAL)")
        conn.execute("INSERT INTO answers VALUES ('avg_b_cell_melanoma_male_responders_t0', ?)", (b_cell,))
        conn.commit()
        print(f"\navg b cells, melanoma male responders at t=0: {b_cell:.2f}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

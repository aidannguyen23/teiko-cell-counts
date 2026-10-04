# backend for the dashboard. only reads from teiko.db, all the analysis
# already happened in pipeline.py. also serves the built react app from frontend/dist
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from analysis.db import ROOT, connect

DIST = ROOT / "frontend" / "dist"

app = FastAPI(title="Loblaw Bio dashboard")
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.exception_handler(FileNotFoundError)
def missing_db(request: Request, exc: FileNotFoundError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


def query(sql: str, params: tuple = ()) -> list[dict]:
    conn = connect()
    try:
        cur = conn.execute(sql, params)
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


@app.get("/api/kpis")
def kpis():
    (row,) = query("""
        SELECT
            (SELECT COUNT(*) FROM samples)  AS samples,
            (SELECT COUNT(*) FROM subjects) AS subjects,
            (SELECT COUNT(*) FROM projects) AS projects,
            (SELECT COUNT(*) FROM subjects WHERE response = 'yes') AS responders
    """)
    return row


@app.get("/api/frequencies")
def frequencies():
    # all 52.5k rows, the table does sorting/filtering in the browser
    return query(
        "SELECT sample, total_count, population, count, percentage "
        "FROM sample_frequencies ORDER BY sample, population"
    )


@app.get("/api/stats")
def stats_results():
    return query("SELECT * FROM stats_results ORDER BY q_value")


@app.get("/api/boxplot")
def boxplot():
    # same subset the models were fit on
    return query("""
        SELECT f.sample, s.subject_id, s.time_from_treatment_start AS time,
               sub.response, f.population, f.percentage
        FROM sample_frequencies f
        JOIN samples s ON s.sample_id = f.sample
        JOIN subjects sub USING (subject_id)
        WHERE sub.condition = 'melanoma'
          AND sub.treatment = 'miraclib'
          AND s.sample_type = 'PBMC'
          AND sub.response IS NOT NULL
    """)


@app.get("/api/diagnostics")
def diagnostics():
    return query("SELECT population, fitted, residual, theoretical_quantile FROM stats_diagnostics")


@app.get("/api/baseline")
def baseline():
    counts = query("SELECT grouping, label, n FROM baseline_counts")
    (answer,) = query(
        "SELECT value FROM answers WHERE question = 'avg_b_cell_melanoma_male_responders_t0'"
    )
    return {
        "total_samples": sum(c["n"] for c in counts if c["grouping"] == "project"),
        "by_project": [c for c in counts if c["grouping"] == "project"],
        "by_response": [c for c in counts if c["grouping"] == "response"],
        "by_sex": [c for c in counts if c["grouping"] == "sex"],
        "avg_b_cell_male_responders": answer["value"],
    }


# frontend. anything thats not /api gets index.html so react router can handle the url
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = DIST / path
        if path and file.is_file() and DIST in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(DIST / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def no_frontend():
        return JSONResponse(
            status_code=503,
            content={"detail": "frontend not built, run `make setup` first"},
        )

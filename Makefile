PYTHON ?= python
PORT ?= 8000

.PHONY: setup pipeline dashboard test

# python deps + build the react frontend into frontend/dist
setup:
	$(PYTHON) -m pip install -r requirements.txt
	cd frontend && npm ci && npm run build

# csv -> teiko.db, then parts 2-4 (takes ~1 min, the mixed models are the slow part)
pipeline:
	$(PYTHON) pipeline.py

# api + built frontend on one server, open http://localhost:$(PORT)
dashboard:
	$(PYTHON) -m uvicorn api.main:app --host 0.0.0.0 --port $(PORT)

test:
	$(PYTHON) -m pytest -q

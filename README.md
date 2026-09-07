# Hima-Drishti — Antarctic Intelligent Ship Routing (SIH Prototype)

AI-assisted dynamic iceberg-risk mapping and risk-aware A* ship routing for the
Prydz Bay / Bharati Station sector._demo predictions are **simulations**, not
operational forecasts.

## How it runs

```
browser -> Vite dev proxy  (dev, :5173)
             /api/ice/* -> node ice-proxy (:3001, NOAA OISST + snapshots)
             /api/*     -> FastAPI backend (:8000, simulation + routing)

browser -> node ice-proxy (prod, single port)
             /api/ice/* -> NOAA / snapshot
             /api/*     -> $SIH_BACKEND (FastAPI), else local demo engine
```

If the Python backend is unreachable, the frontend automatically falls back to a
built-in deterministic demo engine (`src/services/demoEngine.ts`, same grid math
as the backend) so the SIH demo never shows a blank screen. A banner marks demo mode.

## Run locally

Prerequisites: Node 20+, Python 3.11+.

```bash
# 1. backend deps (once)
pip install -r backend/requirements.txt
# or: python3 -m venv backend/venv && backend/venv/bin/pip install -r backend/requirements.txt

# 2. full stack (backend :8000 + ice proxy :3001 + vite :5173)
npm run dev

# backend only
npm run backend

# frontend only (demo-engine fallback, no backend needed)
npm run dev:frontend
```

Open http://localhost:5173 — the dashboard loads the grid, runs Monte Carlo
prediction, computes the risk map and the balanced route automatically.
`Run simulation` recalculates; `Compare` shows fastest / balanced / safest.

Production:

```bash
npm run serve   # builds dist/ and serves it on $PORT (default 3001)
```

Docker (backend):

```bash
docker build -f backend/Dockerfile -t hima-backend .
docker run -p 8000:8000 hima-backend
```

## Backend API (FastAPI, :8000)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness probe |
| GET | `/api/system-status` | pipeline stages, grid size, sources |
| GET | `/api/grid`, `/api/risk-map` | 25×35 risk grid (9 km cells) |
| GET | `/api/icebergs` | 5 tracked bergs |
| GET | `/api/environment` | region summary stats |
| POST | `/api/predict-trajectory` | Monte Carlo ensemble + prob grid |
| POST | `/api/calculate-route` | single A* route |
| POST | `/api/compare-routes` | fastest + safest + balanced |
| POST | `/api/update-weights` | MCDM weights -> fresh risk grid |

Sample route request:

```bash
curl -X POST http://127.0.0.1:8000/api/calculate-route \
  -H 'Content-Type: application/json' \
  -d '{"start":[-65.2,42.5],"destination":[-69.4,76.2],"mode":"balanced","max_risk":0.7,"ship_speed_knots":14.0}'
```

Sample trajectory request:

```bash
curl -X POST http://127.0.0.1:8000/api/predict-trajectory \
  -H 'Content-Type: application/json' \
  -d '{"prediction_hours":72,"num_simulations":200}'
```

## Architecture

- `backend/data_providers/` — `DataProvider` interfaces + `SyntheticAntarcticDataProvider`
  (seeded, spatially correlated ice / currents / wind / waves / depth / berg hotspots).
  Real Copernicus / ERA5 / IBCSO providers implement the same interfaces later.
- `backend/models/lagrangian.py` — `dx/dt = current + wind_factor*wind + ice_factor*ice + noise`.
- `backend/models/monte_carlo.py` — 50–300 perturbed ensembles per berg, cell-entry
  probability grid, confidence + 90th-percentile uncertainty radius.
- `backend/models/risk_engine.py` — normalized 6-factor MCDM → 0–1 score,
  LOW / MODERATE / HIGH / VERY HIGH / EXTREME bands, weights renormalized.
- `backend/models/router.py` — risk-aware A* (8-neighbourhood, hard `max_risk` barrier,
  mode-tuned penalties), distance + ice-slowed time + safety margin.
- `src/services/api.ts` — relative `/api` base, timeouts, demo-engine fallback.
- `src/services/demoEngine.ts` — offline mirror of grid + A* + trajectories.
- `server/ice-proxy.mjs` — NOAA OISST proxy with snapshots + SIH backend pass-through.

## Tests

```bash
backend/venv/bin/python -m pytest backend/tests/test_core.py -q
```

Covers grid harmonization, Lagrangian advection, Monte Carlo ensemble, MCDM risk,
and A* routing.

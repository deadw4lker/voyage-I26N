"""
FastAPI Main Application Server for SIH Antarctic Intelligent Navigation System.
Exposes REST endpoints for environmental grid data, Monte Carlo trajectory prediction,
MCDM risk engine, A* ship routing, and system pipeline status.
"""

import time
import sys
import os

# Allow running as `uvicorn backend.main:app` from repo root OR
# `uvicorn main:app` from inside backend/ .
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from backend.data_providers.synthetic_provider import SyntheticAntarcticDataProvider
    from backend.data_providers.realtime.hybrid import HybridAntarcticDataProvider
    from backend.models.monte_carlo import aggregate_multi_iceberg_probabilities
    from backend.models.risk_engine import compute_grid_risk_map
    from backend.models.router import calculate_route
    from backend.schemas import (
        MCDMWeights, Iceberg, MonteCarloPredictionRequest,
        MonteCarloPredictionResponse, RouteRequest, RouteResponse,
        RouteComparisonResponse, SystemStatusResponse
    )
except ImportError:  # running from inside backend/
    from data_providers.synthetic_provider import SyntheticAntarcticDataProvider
    from data_providers.realtime.hybrid import HybridAntarcticDataProvider
    from models.monte_carlo import aggregate_multi_iceberg_probabilities
    from models.risk_engine import compute_grid_risk_map
    from models.router import calculate_route
    from schemas import (
        MCDMWeights, Iceberg, MonteCarloPredictionRequest,
        MonteCarloPredictionResponse, RouteRequest, RouteResponse,
        RouteComparisonResponse, SystemStatusResponse
    )

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

app = FastAPI(
    title="Antarctic Intelligent Navigation & Risk Prediction API",
    description="SIH Prototype for AI-Assisted Dynamic Iceberg Risk Mapping and Safe Ship Routing",
    version="1.0.0"
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state singleton for prototype demonstration.
# Hybrid provider fuses live public feeds (OISST ice, ETOPO depth, Open-Meteo
# wind/waves/currents) onto the grid; any failed layer falls back to synthetic
# so the demo survives upstream outages. USE_LIVE_DATA=0 forces full synthetic.
try:
    data_provider = HybridAntarcticDataProvider(rows=25, cols=35, seed=42, live=True)
    live_layers = sum(1 for h in data_provider.layer_health() if h['live'])
    print(f'[backend] live layers: {live_layers} ({", ".join(h["layer"] for h in data_provider.layer_health() if h["live"]) or "none — full synthetic"})')
except Exception as e:
    print(f'[backend] hybrid provider failed, full synthetic fallback: {e}')
    data_provider = SyntheticAntarcticDataProvider(rows=25, cols=35, seed=42)
# Heavy Monte Carlo warm-up runs once at startup with a reduced ensemble so
# `uvicorn` boots fast; full-fidelity runs happen on demand via /api/predict-trajectory.
BOOT_SIMS = int(os.environ.get("BOOT_SIMS", "80"))

current_weights = MCDMWeights()
tracked_icebergs = data_provider.get_initial_icebergs()

_t0 = time.time()
latest_monte_carlo = aggregate_multi_iceberg_probabilities(
    tracked_icebergs, data_provider, hours=72, num_simulations=BOOT_SIMS
)
latest_risk_grid = compute_grid_risk_map(
    data_provider, current_weights, latest_monte_carlo["probability_grid"]
)
print(f"[backend] warm-up done in {time.time() - _t0:.1f}s "
      f"({len(tracked_icebergs)} bergs x {BOOT_SIMS} sims, "
      f"{data_provider.rows * data_provider.cols} cells)")


@app.get("/")
def read_root():
    return {
        "project": "Antarctic Intelligent Navigation & Risk Prediction System",
        "sih_track": "AI-Assisted Dynamic Iceberg Risk Mapping & Safe Ship Routing",
        "version": "1.0.0",
        "status": "OPERATIONAL"
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "cells": data_provider.rows * data_provider.cols}


@app.get("/api/system-status", response_model=SystemStatusResponse)
def get_system_status():
    rows, cols = data_provider.get_grid_dimensions()
    health = data_provider.layer_health() if hasattr(data_provider, 'layer_health') else []
    live_by_layer = {h['layer']: h for h in health}

    def src(label: str, fallback: str) -> str:
        h = live_by_layer.get(label)
        if h and h['live']:
            return f"{h['source']} (LIVE{', ' + h['updated'] if h.get('updated') else ''})"
        return fallback

    return SystemStatusResponse(
        status="OPERATIONAL",
        data_harmonized=True,
        grid_cells_count=rows * cols,
        resolution_km=9.0,
        data_sources={
            "sea_ice": src('Sea ice', "Synthetic (Copernicus OSI-SAF schema)"),
            "ocean_currents": src('Ocean currents', "Synthetic (Copernicus Physics schema)"),
            "weather_wind": src('Wind', "Synthetic (ERA5 schema)"),
            "waves": src('Waves', "Synthetic (Copernicus Waves schema)"),
            "historical_icebergs": "Synthetic climatology + live-forced drift",
            "bathymetry": src('Bathymetry', "Synthetic (IBCSO schema)")
        },
        pipeline_stages=[
            {"stage": "Data Ingestion", "status": "ACTIVE", "latency_ms": 12, "records": 6},
            {"stage": "Data Harmonization", "status": "ACTIVE", "latency_ms": 18, "records": rows * cols},
            {"stage": "Feature Engineering", "status": "ACTIVE", "latency_ms": 24, "features": 18},
            {"stage": "Monte Carlo Ensemble", "status": "ACTIVE", "latency_ms": 140, "simulations": 300},
            {"stage": "Lagrangian Advection", "status": "ACTIVE", "latency_ms": 45, "dt_hours": 1.0},
            {"stage": "MCDM Weighted Overlay", "status": "ACTIVE", "latency_ms": 15, "weights_count": 6},
            {"stage": "Dynamic Risk Map", "status": "ACTIVE", "latency_ms": 22, "updated": "Live"},
            {"stage": "Optimal A* Ship Route", "status": "ACTIVE", "latency_ms": 35, "algorithm": "Risk-Aware A*"}
        ],
        data_health=health,
    )


@app.get("/api/grid", response_model=List[List[Dict[str, Any]]])
def get_grid():
    return latest_risk_grid


@app.get("/api/risk-map", response_model=List[List[Dict[str, Any]]])
def get_risk_map():
    return latest_risk_grid


@app.get("/api/icebergs", response_model=List[Iceberg])
def get_icebergs():
    return [Iceberg(**berg) for berg in tracked_icebergs]


@app.post("/api/update-weights", response_model=List[List[Dict[str, Any]]])
def update_weights(weights: MCDMWeights):
    global current_weights, latest_risk_grid
    current_weights = weights
    latest_risk_grid = compute_grid_risk_map(data_provider, current_weights, latest_monte_carlo["probability_grid"])
    return latest_risk_grid


@app.post("/api/predict-trajectory", response_model=MonteCarloPredictionResponse)
def predict_trajectory(req: MonteCarloPredictionRequest):
    global latest_monte_carlo, latest_risk_grid

    try:
        selected_bergs = tracked_icebergs
        if req.iceberg_ids:
            selected_bergs = [b for b in tracked_icebergs if b["id"] in req.iceberg_ids]

        # Clamp cost: 5 bergs x N sims x hours/2 steps. Cap at 300 sims for latency.
        sims = max(50, min(req.num_simulations, 300))
        hours = max(6, min(req.prediction_hours, 168))

        res = aggregate_multi_iceberg_probabilities(
            selected_bergs, data_provider,
            hours=hours, num_simulations=sims
        )
        latest_monte_carlo = res
        latest_risk_grid = compute_grid_risk_map(data_provider, current_weights, latest_monte_carlo["probability_grid"])

        return MonteCarloPredictionResponse(
            prediction_hours=hours,
            num_simulations=sims,
            trajectories=res["trajectories"],
            probability_grid=res["probability_grid"],
            confidence=res["confidence"],
            uncertainty_radius_km=res["uncertainty_radius_km"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"trajectory prediction failed: {e}")


@app.post("/api/calculate-route", response_model=RouteResponse)
def calculate_single_route(req: RouteRequest):
    try:
        res = calculate_route(
            req.start, req.destination, latest_risk_grid,
            mode=req.mode, max_risk=req.max_risk, ship_speed_knots=req.ship_speed_knots
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"route calculation failed: {e}")


@app.post("/api/compare-routes", response_model=RouteComparisonResponse)
def compare_all_routes(req: RouteRequest):
    try:
        fastest = calculate_route(req.start, req.destination, latest_risk_grid, mode="fastest", max_risk=req.max_risk, ship_speed_knots=req.ship_speed_knots)
        safest = calculate_route(req.start, req.destination, latest_risk_grid, mode="safest", max_risk=req.max_risk, ship_speed_knots=req.ship_speed_knots)
        balanced = calculate_route(req.start, req.destination, latest_risk_grid, mode="balanced", max_risk=req.max_risk, ship_speed_knots=req.ship_speed_knots)

        return RouteComparisonResponse(
            fastest=fastest,
            safest=safest,
            balanced=balanced
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"route comparison failed: {e}")


@app.get("/api/environment")
def get_environment_summary():
    return {
        "region": "Prydz Bay / Bharati Station (Antarctica)",
        "bounds": data_provider.get_bounds(),
        "grid_resolution": "9 km x 9 km",
        "tracked_icebergs_count": len(tracked_icebergs),
        "mean_sea_ice_concentration": float(data_provider.ice_concentration.mean()),
        "max_sea_ice_concentration": float(data_provider.ice_concentration.max()),
        "mean_current_speed_ms": float(data_provider.current_speed.mean()),
        "mean_wind_speed_kmh": float(data_provider.wind_speed.mean()),
        "mean_wave_height_m": float(data_provider.wave_height.mean()),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app" if os.path.exists("backend/main.py") else "main:app",
                host="127.0.0.1", port=8000, reload=True)

"""
Pytest unit test suite for SIH Antarctic Intelligent Navigation backend.
Tests data harmonization grid, Lagrangian advection, Monte Carlo simulation,
MCDM risk engine, and A* routing engine.
"""

import pytest
import numpy as np
from backend.data_providers.synthetic_provider import SyntheticAntarcticDataProvider
from backend.models.lagrangian import calculate_velocity, advect_iceberg, simulate_trajectory
from backend.models.monte_carlo import generate_iceberg_ensemble
from backend.models.risk_engine import compute_grid_risk_map
from backend.models.router import calculate_route
from backend.schemas import MCDMWeights

@pytest.fixture
def provider():
    return SyntheticAntarcticDataProvider(rows=15, cols=20, seed=42)

def test_data_provider_grid(provider):
    rows, cols = provider.get_grid_dimensions()
    assert rows == 15
    assert cols == 20
    cell = provider.get_cell_features(0, 0)
    assert "latitude" in cell
    assert "longitude" in cell
    assert 0.0 <= cell["ice_concentration"] <= 1.0
    assert cell["water_depth"] > 0.0

def test_lagrangian_advection(provider):
    u_tot, v_tot = calculate_velocity(0.2, 0.1, 5.0, -2.0, noise_sigma=0.0)
    assert u_tot > 0.2
    lat, lon = advect_iceberg(-65.0, 45.0, u_tot, v_tot, dt_seconds=3600.0)
    assert lat != -65.0
    assert lon != 45.0

    traj = simulate_trajectory(-65.0, 45.0, provider, hours=12.0, dt_hours=2.0)
    assert len(traj) == 7

def test_monte_carlo_ensemble(provider):
    res = generate_iceberg_ensemble(-65.0, 45.0, provider, hours=24, num_simulations=50)
    assert "probability_grid" in res
    assert "trajectories" in res
    assert res["confidence"] > 0
    assert res["uncertainty_radius_km"] > 0

def test_mcdm_risk_engine(provider):
    weights = MCDMWeights(iceberg_risk=0.4, sea_ice_risk=0.3)
    risk_grid = compute_grid_risk_map(provider, weights)
    assert len(risk_grid) == 15
    assert len(risk_grid[0]) == 20
    sample_cell = risk_grid[5][5]
    assert 0.0 <= sample_cell["risk_score"] <= 1.0
    assert sample_cell["risk_level"] in ["LOW", "MODERATE", "HIGH", "VERY HIGH", "EXTREME"]

def test_routing_engine(provider):
    weights = MCDMWeights()
    risk_grid = compute_grid_risk_map(provider, weights)
    start_pos = (risk_grid[2][2]["latitude"], risk_grid[2][2]["longitude"])
    dest_pos = (risk_grid[10][15]["latitude"], risk_grid[10][15]["longitude"])

    fastest = calculate_route(start_pos, dest_pos, risk_grid, mode="fastest")
    safest = calculate_route(start_pos, dest_pos, risk_grid, mode="safest")

    assert len(fastest.route) >= 2
    assert len(safest.route) >= 2
    assert fastest.distance_km > 0
    assert safest.distance_km > 0

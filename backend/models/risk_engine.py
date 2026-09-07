"""
MCDM Dynamic Risk Engine for SIH Antarctic Intelligent Navigation.

Combines multiple normalized environmental risk factors into a unified 0.0 - 1.0 risk score per grid cell:
Risk = w1*Iceberg + w2*SeaIce + w3*Current + w4*Wind + w5*Wave + w6*Bathymetry

Supports dynamic weight reconfiguration from frontend UI.
Risk Level Categories:
- 0.0 - 0.2 : LOW
- 0.2 - 0.4 : MODERATE
- 0.4 - 0.6 : HIGH
- 0.6 - 0.8 : VERY HIGH
- 0.8 - 1.0 : EXTREME
"""

import numpy as np
from typing import Dict, List, Any
from backend.schemas import MCDMWeights

def normalize_feature(value: float, min_val: float, max_val: float) -> float:
    """Normalizes value to [0.0, 1.0] range."""
    if max_val <= min_val:
        return 0.0
    return float(np.clip((value - min_val) / (max_val - min_val), 0.0, 1.0))

def calculate_cell_risk_components(
    cell: Dict[str, Any],
    monte_carlo_prob: float = 0.0
) -> Dict[str, float]:
    """
    Computes individual normalized risk scores (0.0 to 1.0) for each factor.
    """
    # 1. Iceberg Risk (combination of predicted Monte Carlo probability + historical density)
    iceberg_risk = float(np.clip(0.70 * monte_carlo_prob + 0.30 * cell["historical_iceberg_probability"], 0.0, 1.0))

    # 2. Sea Ice Risk (non-linear penalty for heavy pack ice)
    ice_conc = cell["ice_concentration"]
    sea_ice_risk = float(np.clip(ice_conc ** 1.4, 0.0, 1.0))

    # 3. Ocean Current Risk (strong current shear or adverse drift > 0.6 m/s)
    curr_speed = cell["current_speed"]
    current_risk = float(np.clip(curr_speed / 1.0, 0.0, 1.0))

    # 4. Wind/Weather Risk (gale force winds > 60 km/h)
    wind_spd = cell["wind_speed"]
    wind_risk = float(np.clip((wind_spd / 70.0) ** 1.2, 0.0, 1.0))

    # 5. Wave Risk (significant wave height > 5.0m)
    wave_h = cell["wave_height"]
    wave_risk = float(np.clip(wave_h / 5.5, 0.0, 1.0))

    # 6. Bathymetry Risk (shallow water depth < 250m posing grounding risk for deep draft vessels)
    depth = cell["water_depth"]
    if depth < 150.0:
        bathymetry_risk = 1.0
    elif depth < 400.0:
        bathymetry_risk = float((400.0 - depth) / 250.0)
    else:
        bathymetry_risk = 0.05

    return {
        "iceberg_risk": iceberg_risk,
        "sea_ice_risk": sea_ice_risk,
        "ocean_current_risk": current_risk,
        "weather_wind_risk": wind_risk,
        "wave_risk": wave_risk,
        "bathymetry_risk": bathymetry_risk,
    }

def get_risk_level_label(score: float) -> str:
    """Maps 0.0-1.0 risk score to standard SIH category label."""
    if score >= 0.80:
        return "EXTREME"
    elif score >= 0.60:
        return "VERY HIGH"
    elif score >= 0.40:
        return "HIGH"
    elif score >= 0.20:
        return "MODERATE"
    else:
        return "LOW"

def compute_grid_risk_map(
    data_provider: Any,
    weights: MCDMWeights,
    probability_grid: List[List[float]] = None
) -> List[List[Dict[str, Any]]]:
    """
    Computes MCDM risk score and risk level label for every cell in the environmental grid.
    """
    rows, cols = data_provider.get_grid_dimensions()

    # Normalize weights so sum equals 1.0
    total_w = (
        weights.iceberg_risk + weights.sea_ice_risk + weights.ocean_current_risk +
        weights.weather_wind_risk + weights.wave_risk + weights.bathymetry_risk
    )
    if total_w <= 0:
        total_w = 1.0

    w_iceberg = weights.iceberg_risk / total_w
    w_sea_ice = weights.sea_ice_risk / total_w
    w_current = weights.ocean_current_risk / total_w
    w_wind = weights.weather_wind_risk / total_w
    w_wave = weights.wave_risk / total_w
    w_bathy = weights.bathymetry_risk / total_w

    risk_grid = []

    for r in range(rows):
        row_cells = []
        for c in range(cols):
            cell = data_provider.get_cell_features(r, c)
            mc_prob = probability_grid[r][c] if probability_grid and r < len(probability_grid) and c < len(probability_grid[0]) else 0.0

            comp = calculate_cell_risk_components(cell, mc_prob)

            score = (
                w_iceberg * comp["iceberg_risk"] +
                w_sea_ice * comp["sea_ice_risk"] +
                w_current * comp["ocean_current_risk"] +
                w_wind * comp["weather_wind_risk"] +
                w_wave * comp["wave_risk"] +
                w_bathy * comp["bathymetry_risk"]
            )
            score = float(np.clip(score, 0.0, 1.0))
            level = get_risk_level_label(score)

            cell_out = dict(cell)
            cell_out["risk_score"] = round(score, 3)
            cell_out["risk_level"] = level
            cell_out["iceberg_probability"] = round(mc_prob, 3)
            cell_out["risk_components"] = {k: round(v, 3) for k, v in comp.items()}

            row_cells.append(cell_out)
        risk_grid.append(row_cells)

    return risk_grid

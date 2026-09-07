"""
Risk Engine for Antarctic Ship Routing.

Computes dynamic risk scores for each grid cell using Multi-Criteria Decision Making (MCDM).
Combines multiple environmental risk factors with configurable weights.

Risk categories:
  0.0 - 0.2   LOW
  0.2 - 0.4   MODERATE
  0.4 - 0.6   HIGH
  0.6 - 0.8   VERY HIGH
  0.8 - 1.0   EXTREME
"""

import numpy as np
from typing import Dict, Any, Optional


# Default MCDM weights (configurable via UI)
DEFAULT_WEIGHTS = {
    'iceberg_risk': 0.35,
    'sea_ice_risk': 0.25,
    'current_risk': 0.10,
    'wind_risk': 0.10,
    'wave_risk': 0.10,
    'bathymetry_risk': 0.10,
}


def normalize_feature(values: np.ndarray) -> np.ndarray:
    """Normalize a feature array to 0-1 range."""
    v_min = np.min(values)
    v_max = np.max(values)
    if v_max - v_min == 0:
        return np.zeros_like(values)
    return (values - v_min) / (v_max - v_min)


def _get_grid_field(grid: Dict[str, Any], field: str) -> np.ndarray:
    """Get a field from grid dict, converting from list if needed."""
    data = grid.get(field)
    if isinstance(data, list):
        data = np.array(data)
    return np.array(data)


def calculate_iceberg_risk(
    grid: Dict[str, Any],
    trajectory_probability: Optional[np.ndarray] = None,
) -> np.ndarray:
    """
    Calculate iceberg risk for each grid cell.
    
    Combines historical iceberg density with predicted trajectory probability.
    Higher risk where both historical density and predicted probability are high.
    """
    hist_prob = _get_grid_field(grid, 'historical_iceberg_probability')
    hist_risk = normalize_feature(hist_prob)
    
    if trajectory_probability is not None:
        traj_risk = normalize_feature(trajectory_probability)
        # Combined: weight toward trajectory prediction for routing
        risk = 0.6 * traj_risk + 0.4 * hist_risk
    else:
        # Use historical probability as proxy
        risk = hist_risk
    
    return risk


def calculate_sea_ice_risk(
    grid: Dict[str, Any],
    ship_type: str = 'ice-strengthened',
) -> np.ndarray:
    """
    Calculate sea ice risk.
    
    Higher ice concentration = higher risk.
    Risk level depends on ship type capabilities.
    """
    ice_conc = _get_grid_field(grid, 'ice_concentration')
    
    if ship_type == 'ice-strengthened':
        # Can handle higher concentrations
        risk = normalize_feature(ice_conc)
    elif ship_type == 'standard':
        # More conservative; risk rises steeply above 40%
        risk = normalize_feature(ice_conc ** 2 * 1.5)
    else:  # open-water
        # Very high risk even at moderate ice
        risk = normalize_feature(ice_conc ** 3)
    
    return risk


def calculate_current_risk(
    grid: Dict[str, Any],
    ship_speed: float = 15,  # knots ≈ 7.7 m/s
    threshold: float = 1.0,  # m/s threshold for significant current
) -> np.ndarray:
    """
    Calculate ocean current risk.
    
    Risk when current speed approaches or exceeds ship speed,
    making maneuvering difficult.
    """
    current_speed = _get_grid_field(grid, 'current_speed')
    # Risk increases as current speed approaches ship speed
    speed_ratio = normalize_feature(current_speed)  # already 0-1
    # Peak risk when current ≈ ship speed
    risk = speed_ratio * np.exp(1 - speed_ratio)  # bell-shaped around 1.0
    return risk


def calculate_wind_risk(
    grid: Dict[str, Any],
    ship_speed: float = 15,  # knots ≈ 7.7 m/s = 27.8 km/h
    threshold: float = 15,  # m/s ≈ 54 km/h
) -> np.ndarray:
    """
    Calculate weather/wind risk.
    
    Higher wind = higher risk for safe navigation.
    """
    wind_speed = _get_grid_field(grid, 'wind_speed')
    # Normalize wind speed (typical range 0-30 m/s)
    wind_norm = normalize_feature(wind_speed)
    # Exponential increase in risk with wind
    risk = np.clip(wind_norm * 1.5, 0, 1)
    return risk


def calculate_wave_risk(
    grid: Dict[str, Any],
    significant_threshold: float = 2.0,  # meters
) -> np.ndarray:
    """
    Calculate wave risk.
    
    Higher waves = higher risk, especially above 2m significant height.
    """
    wave_height = _get_grid_field(grid, 'wave_height')
    # Normalize wave height
    wh_norm = normalize_feature(wave_height)
    # Risk increases nonlinearly above 1m
    risk = np.clip(wh_norm * 2.0, 0, 1)
    return risk


def calculate_bathymetry_risk(
    grid: Dict[str, Any],
    ship_draft: float = 7.0,  # meters
    shallow_threshold: float = 200,  # meters
) -> np.ndarray:
    """
    Calculate bathymetry/risk.
    
    Shallow water risk increases as depth approaches draft.
    Very deep water has low risk.
    """
    water_depth = _get_grid_field(grid, 'water_depth')
    # Normalize: shallow = high risk, deep = low risk
    depth_norm = normalize_feature(water_depth)
    
    # Risk is high when depth is near or below draft
    # Use a function that peaks near draft depth
    depth_ratio = depth_norm * np.max(water_depth) / ship_draft
    
    # Risk: high when depth < 2-3x draft, low when much deeper
    risk = np.exp(-depth_ratio / 3.0)  # Decays as depth increases
    risk = 1 - risk  # Invert: high risk when shallow
    risk = np.clip(risk, 0, 1)
    
    return risk


def calculate_total_risk(
    grid: Dict[str, Any],
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Calculate total risk score for every grid cell using MCDM.
    
    Args:
        grid: EnvironmentalGrid as dict with all features
        weights: Dict of weights (iceberg, sea_ice, current, wind, wave, bathymetry)
    
    Returns:
        Dict with total_risk (0-1), risk_level, and per-factor risks
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS.copy()
    
    # Normalize all features to 0-1
    iceberg_risk = calculate_iceberg_risk(grid)
    sea_ice_risk = calculate_sea_ice_risk(grid)
    current_risk = calculate_current_risk(grid)
    wind_risk = calculate_wind_risk(grid)
    wave_risk = calculate_wave_risk(grid)
    bathymetry_risk = calculate_bathymetry_risk(grid)
    
    # Combine with weights
    total_risk = (
        weights.get('iceberg_risk', 0.35) * iceberg_risk +
        weights.get('sea_ice_risk', 0.25) * sea_ice_risk +
        weights.get('current_risk', 0.10) * current_risk +
        weights.get('wind_risk', 0.10) * wind_risk +
        weights.get('wave_risk', 0.10) * wave_risk +
        weights.get('bathymetry_risk', 0.10) * bathymetry_risk
    )
    
    # Clip to 0-1
    total_risk = np.clip(total_risk, 0, 1)
    
    # Risk level classification
    total_risk_arr = np.array(total_risk).flatten()
    risk_level = np.zeros(len(total_risk_arr), dtype='U10')
    risk_level[total_risk_arr <= 0.2] = 'LOW'
    risk_level[(total_risk_arr > 0.2) & (total_risk_arr <= 0.4)] = 'MODERATE'
    risk_level[(total_risk_arr > 0.4) & (total_risk_arr <= 0.6)] = 'HIGH'
    risk_level[(total_risk_arr > 0.6) & (total_risk_arr <= 0.8)] = 'VERY HIGH'
    risk_level[total_risk_arr > 0.8] = 'EXTREME'
    
    return {
        'total_risk': total_risk.tolist() if hasattr(total_risk, 'tolist') else total_risk,
        'risk_level': risk_level.tolist() if hasattr(risk_level, 'tolist') else risk_level,
        'iceberg_risk': iceberg_risk.tolist() if hasattr(iceberg_risk, 'tolist') else iceberg_risk,
        'sea_ice_risk': sea_ice_risk.tolist() if hasattr(sea_ice_risk, 'tolist') else sea_ice_risk,
        'current_risk': current_risk.tolist() if hasattr(current_risk, 'tolist') else current_risk,
        'wind_risk': wind_risk.tolist() if hasattr(wind_risk, 'tolist') else wind_risk,
        'wave_risk': wave_risk.tolist() if hasattr(wave_risk, 'tolist') else wave_risk,
        'bathymetry_risk': bathymetry_risk.tolist() if hasattr(bathymetry_risk, 'tolist') else bathymetry_risk,
        'weights': weights,
    }


def update_weights(new_weights: Dict[str, float]) -> Dict[str, float]:
    """Validate and return updated weights."""
    valid_keys = {'iceberg_risk', 'sea_ice_risk', 'current_risk', 'wind_risk', 'wave_risk', 'bathymetry_risk'}
    valid_keys_input = set(new_weights.keys())
    
    if not valid_keys_input.issubset(valid_keys):
        raise ValueError(f"Invalid weight keys. Must be subset of {valid_keys}")
    
    # Ensure weights sum to 1.0 (or normalize them)
    total = sum(new_weights.values())
    if abs(total - 1.0) > 0.01:
        # Normalize
        normalized = {k: v / total for k, v in new_weights.items()}
    else:
        normalized = new_weights
    
    return normalized
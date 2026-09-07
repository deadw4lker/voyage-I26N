"""
Synthetic Antarctic environmental data simulation.

Generates realistic Antarctic grid data with spatial correlations:
- Sea ice increases toward Antarctica
- Ice drift has directional patterns
- Ocean currents follow Antarctic Circumpolar Current patterns
- Wind follows polar patterns
- Wave height varies with ice concentration
- Water depth varies with bathymetric features
- Iceberg density has hotspots
- Deterministic seed for reproducibility
"""

import numpy as np
from typing import Dict, Any, Tuple
from dataclasses import dataclass


# Deterministic seed for reproducible demonstrations
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)


@dataclass
class GridConfig:
    """Configuration for the environmental grid."""
    lat_min: float = -75.0
    lat_max: float = -55.0
    lon_min: float = 25.0
    lon_max: float = 85.0
    grid_size_km: int = 9  # 9km x 9km grid cells
    n_lat: int = 25
    n_lon: int = 60


def _generate_spatial_noise(lat_grid, lon_grid, correlation_km=80, seed=100):
    """Generate spatially correlated random noise."""
    n_lat, n_lon = lat_grid.shape
    np.random.seed(seed)
    noise = np.random.normal(size=(n_lat, n_lon))
    
    # Simple smoothing via averaging with neighbors
    padded = np.pad(noise, 2, mode='wrap')
    smoothed = np.zeros_like(noise)
    for i in range(n_lat):
        for j in range(n_lon):
            total = 0.0
            count = 0.0
            for di in range(-3, 4):
                for dj in range(-3, 4):
                    w = np.exp(-(di**2 + dj**2) / (2 * correlation_km**2))
                    total += padded[i + di, j + dj] * w
                    count += w
            if count > 0:
                smoothed[i, j] = total / count
    
    # Normalize to [-1, 1] then scale
    smoothed = (smoothed - np.min(smoothed)) / (np.max(smoothed) - np.min(smoothed))
    smoothed = smoothed * 2 - 1  # Now in [-1, 1]
    
    return smoothed


def _generate_iceberg_density_hotspots(lat_grid, lon_grid):
    """Generate iceberg density with spatial hotspots in known congregation areas."""
    n_lat, n_lon = lat_grid.shape
    
    # Base random density
    base = np.random.uniform(0.05, 0.2, size=(n_lat, n_lon))
    
    # Hotspot 1: Weddell Sea sector (around -70, 50)
    lat1, lon1 = -70.0, 50.0
    dist1 = np.sqrt((lat_grid - lat1)**2 + (lon_grid - lon1)**2)
    hotspot1 = np.exp(-dist1**2 / (2 * 8**2)) * 0.4
    
    # Hotspot 2: Ross Sea sector (around -78, 170)
    lat2, lon2 = -78.0, 170.0
    dist2 = np.sqrt((lat_grid - lat2)**2 + (lon_grid - lon2)**2)
    hotspot2 = np.exp(-dist2**2 / (2 * 10**2)) * 0.3
    
    # Hotspot 3: Antarctic Peninsula (around -64, -60)
    lat3, lon3 = -64.0, -60.0
    dist3 = np.sqrt((lat_grid - lat3)**2 + (lon_grid - lon3)**2)
    hotspot3 = np.exp(-dist3**2 / (2 * 6**2)) * 0.35
    
    combined = base + hotspot1 + hotspot2 + hotspot3
    
    # Normalize to 0-1
    if combined.max() > combined.min():
        combined = (combined - combined.min()) / (combined.max() - combined.min())
    
    return np.clip(combined, 0, 1)


def generate_antartic_grid(config: GridConfig = None) -> dict:
    """
    Generate a realistic Antarctic environmental grid.
    
    Returns dict with all environmental variables as 2D arrays.
    """
    if config is None:
        config = GridConfig()
    
    # Generate grid coordinates
    lats = np.linspace(config.lat_min, config.lat_max, config.n_lat)
    lons = np.linspace(config.lon_min, config.lon_max, config.n_lon)
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing='ij')
    
    # Distance from South Pole (for ice concentration gradient)
    pole_lat = -75.0
    dist_from_pole = np.abs(lat_grid - pole_lat)
    
    # 1. Sea Ice Concentration: increases toward Antarctica
    ice_base = np.clip(0.1 + 0.7 * (1 - dist_from_pole / np.max(dist_from_pole)), 0, 1)
    spatial_noise = _generate_spatial_noise(lat_grid, lon_grid, correlation_km=80, seed=100)
    ice_concentration = np.clip(ice_base + 0.1 * spatial_noise, 0, 1)
    
    # 2. Ice Drift Speed: higher where ice is present
    ice_drift_speed = ice_concentration * np.random.uniform(0.05, 0.2, size=ice_concentration.shape) + 0.01
    ice_drift_direction = np.random.uniform(0, 360, size=ice_concentration.shape)
    
    # 3. Ice Type based on concentration
    ice_type = np.where(ice_concentration > 0.8, 1,  # multi-year
               np.where(ice_concentration > 0.3, 0, 2))  # first-year / open water
    
    # 4. Ocean Currents: Antarctic Circumpolar Current
    lat_weight = np.abs(lat_grid - pole_lat) / np.max(dist_from_pole)
    current_speed_base = 0.2 + 0.3 * (1 - lat_weight)  # Stronger near north
    current_speed = current_speed_base * ice_concentration**0.5 + 0.02 * np.random.normal(
        size=ice_concentration.shape)
    current_direction = np.where(
        lat_grid < -65,
        np.random.uniform(80, 100, size=current_speed.shape),  # East-northeast
        np.random.uniform(60, 120, size=current_speed.shape)   # East-southeast
    )
    
    # 5. Wind: Polar cell pattern, prevailing westerlies
    wind_speed = np.random.uniform(5, 25, size=ice_concentration.shape)
    wind_direction = np.where(
        lat_grid < -60,
        np.random.uniform(200, 260, size=wind_speed.shape),  # WSW to WNW
        np.random.uniform(240, 300, size=wind_speed.shape)   # WNW to NW
    )
    
    # 6. Wave Height: related to wind and ice concentration
    wave_base = wind_speed * 0.1 * (1 - ice_concentration)**0.5
    wave_height = np.clip(wave_base + 0.3 * np.random.normal(size=wave_base.shape), 0.1, 10)
    wave_direction = np.mod(wind_direction + np.random.uniform(-20, 20, size=wind_direction.shape), 360)
    
    # 7. Water Depth: bathymetric features
    depth_base = 4000 * np.ones_like(ice_concentration)
    # Continental shelf near ice edge
    ice_edge_dist = np.where(ice_concentration > 0.3,
                              np.random.uniform(0, 200, size=ice_concentration.shape),
                              500)  # Far from ice = deeper
    depth_shelf = 4000 - 3000 * np.exp(-ice_edge_dist / 100)  # Shelf decreases rapidly
    water_depth = np.clip(depth_shelf + 100 * np.random.normal(size=depth_shelf.shape), 100, 6000)
    
    # 8. Historical Iceberg Density: hotspots
    iceberg_density = _generate_iceberg_density_hotspots(lat_grid, lon_grid)
    # Correlate with ice concentration
    iceberg_probability = np.clip(iceberg_density * ice_concentration**0.5 + 0.05 * np.random.normal(
        size=ice_concentration.shape), 0, 1)
    
    return {
        'latitudes': lat_grid,
        'longitudes': lon_grid,
        'ice_concentration': ice_concentration,
        'ice_drift_speed': ice_drift_speed,
        'ice_drift_direction': ice_drift_direction,
        'ice_type': ice_type,
        'current_speed': current_speed,
        'current_direction': current_direction,
        'wind_speed': wind_speed,
        'wind_direction': wind_direction,
        'wave_height': wave_height,
        'wave_direction': wave_direction,
        'water_depth': water_depth,
        'historical_iceberg_density': iceberg_density,
        'historical_iceberg_probability': iceberg_probability,
    }


def grid_to_dict(grid: dict) -> Dict[str, Any]:
    """Convert grid dict to serializable dict with lists instead of arrays."""
    return {k: v.tolist() if hasattr(v, 'tolist') else v for k, v in grid.items()}


def get_default_grid() -> dict:
    """Get the default generated Antarctic grid."""
    return generate_antartic_grid()


def get_default_grid_dict() -> Dict[str, Any]:
    """Get the default grid as serializable dict."""
    return grid_to_dict(get_default_grid())
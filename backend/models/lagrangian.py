"""
Lagrangian Iceberg Advection Engine for SIH Antarctic Navigation.

Physics-inspired kinematic advection model for tracking iceberg drift trajectory:
dx/dt = v_current_x + wind_factor * v_wind_x + ice_factor * v_ice_x + noise_x
dy/dt = v_current_y + wind_factor * v_wind_y + ice_factor * v_ice_y + noise_y

Inputs:
- iceberg initial (lat, lon)
- ocean current velocity (u, v) in m/s
- 10m wind velocity (u, v) in m/s
- sea ice drift velocity (u, v) in m/s
- timestep dt in seconds

Output:
- predicted iceberg position (lat, lon) at t + dt
"""

import numpy as np
from typing import Tuple, Dict, Any, List

METERS_PER_DEGREE_LAT = 111139.0

def calculate_velocity(
    u_curr: float,
    v_curr: float,
    u_wind: float,
    v_wind: float,
    u_ice: float = 0.0,
    v_ice: float = 0.0,
    wind_factor: float = 0.02,
    ice_factor: float = 0.35,
    noise_sigma: float = 0.03
) -> Tuple[float, float]:
    """
    Computes effective velocity vector (u_total, v_total) in m/s.
    """
    noise_u = np.random.normal(0, noise_sigma)
    noise_v = np.random.normal(0, noise_sigma)

    u_tot = u_curr + wind_factor * u_wind + ice_factor * u_ice + noise_u
    v_tot = v_curr + wind_factor * v_wind + ice_factor * v_ice + noise_v

    return (u_tot, v_tot)

def advect_iceberg(
    lat: float,
    lon: float,
    u_tot: float,
    v_tot: float,
    dt_seconds: float = 3600.0
) -> Tuple[float, float]:
    """
    Advects iceberg from (lat, lon) using total velocity (u_tot, v_tot) over dt_seconds.
    """
    dy_meters = v_tot * dt_seconds
    dx_meters = u_tot * dt_seconds

    dlat = dy_meters / METERS_PER_DEGREE_LAT
    cos_lat = max(0.1, np.cos(np.radians(lat)))
    dlon = dx_meters / (METERS_PER_DEGREE_LAT * cos_lat)

    return (lat + dlat, lon + dlon)

def simulate_trajectory(
    start_lat: float,
    start_lon: float,
    data_provider: Any,
    hours: float = 72.0,
    dt_hours: float = 1.0,
    wind_factor: float = 0.02,
    ice_factor: float = 0.35,
    noise_sigma: float = 0.03
) -> List[Dict[str, float]]:
    """
    Simulates step-by-step Lagrangian trajectory for a single iceberg over `hours`.
    """
    trajectory = [{"timestamp": 0.0, "latitude": start_lat, "longitude": start_lon}]
    curr_lat, curr_lon = start_lat, start_lon
    dt_seconds = dt_hours * 3600.0
    steps = int(hours / dt_hours)

    rows, cols = data_provider.get_grid_dimensions()
    min_lat, max_lat, min_lon, max_lon = data_provider.get_bounds()

    for step in range(1, steps + 1):
        # Find nearest grid cell in environmental grid
        r = int(np.clip((max_lat - curr_lat) / (max_lat - min_lat) * (rows - 1), 0, rows - 1))
        c = int(np.clip((curr_lon - min_lon) / (max_lon - min_lon) * (cols - 1), 0, cols - 1))

        cell = data_provider.get_cell_features(r, c)
        u_curr = cell["u_current"]
        v_curr = cell["v_current"]
        u_wind = cell["u_wind"]
        v_wind = cell["v_wind"]

        # Ice drift vector from speed/direction
        ice_rad = np.radians(cell["ice_drift_direction"])
        u_ice = cell["ice_drift_speed"] * np.sin(ice_rad)
        v_ice = cell["ice_drift_speed"] * np.cos(ice_rad)

        u_tot, v_tot = calculate_velocity(
            u_curr, v_curr, u_wind, v_wind, u_ice, v_ice,
            wind_factor=wind_factor, ice_factor=ice_factor, noise_sigma=noise_sigma
        )

        curr_lat, curr_lon = advect_iceberg(curr_lat, curr_lon, u_tot, v_tot, dt_seconds)
        trajectory.append({
            "timestamp": float(step * dt_hours),
            "latitude": float(curr_lat),
            "longitude": float(curr_lon)
        })

    return trajectory

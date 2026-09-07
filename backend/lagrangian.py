"""
Lagrangian Iceberg Advection Model.

Simplified physics-based model for predicting iceberg trajectory.
Treats iceberg as a particle advected by ocean currents, wind, and ice drift.

Basic equation:
  dx/dt = u_current + f_wind * u_wind + u_ice_drift + noise
  dy/dt = v_current + f_wind * v_wind + v_ice_drift + noise

Where f_wind is a wind factor determining how much wind influences the iceberg.
"""

import numpy as np
from typing import List, Tuple, Dict, Any


def _get_grid(grid: Any, key: str) -> np.ndarray:
    """Get a 2D numpy array from grid (dict or object)."""
    data = grid[key] if isinstance(grid, dict) else getattr(grid, key)
    return np.array(data)


def _get_2d(grid: Any, key: str, i: int, j: int) -> float:
    """Get a 2D grid cell value."""
    arr = _get_grid(grid, key)
    return float(arr[i, j])


def calculate_velocity(
    position: Tuple[float, float],
    current_velocity: Tuple[float, float],
    wind_velocity: Tuple[float, float],
    ice_drift: Tuple[float, float],
    wind_factor: float = 0.01,
    dt: float = 3600,  # 1 hour in seconds
) -> Tuple[float, float]:
    """
    Calculate the velocity of an iceberg at a given position.
    
    Args:
        position: (lat, lon) in degrees
        current_velocity: (u, v) in m/s (zonal, meridional)
        wind_velocity: (u_wind, v_wind) in m/s
        ice_drift: (u_ice, v_ice) in m/s
        wind_factor: coupling factor for wind influence (default 0.01)
        dt: time step in seconds
    
    Returns:
        (lat_change, lon_change) in degrees for the time step dt
    """
    lat, lon = position
    u_curr, v_curr = current_velocity
    u_wind, v_wind = wind_velocity
    u_ice, v_ice = ice_drift
    
    # Total advection velocity
    u_total = u_curr + wind_factor * u_wind + u_ice
    v_total = v_curr + wind_factor * v_wind + v_ice
    
    # Convert velocity (m/s) to degree change per time step
    # At latitude lat, 1 degree of longitude = 111.32 * cos(lat) km
    # 1 degree of latitude ≈ 111.32 km
    R = 6371000  # Earth radius in meters
    
    # Change in latitude (degrees)
    dlat = (v_total * dt) / (R * np.pi / 180)  # = v_total * dt / 111319.5
    
    # Change in longitude (degrees) - account for cosine of latitude
    dlon = (u_total * dt) / (R * np.pi / 180 * np.cos(np.radians(lat)) )  # = u_total * dt / (111319.5 * cos(lat))
    
    return (dlat, dlon)


def advect_iceberg(
    position: Tuple[float, float],
    current_velocity: Tuple[float, float],
    wind_velocity: Tuple[float, float],
    ice_drift: Tuple[float, float],
    wind_factor: float = 0.01,
    dt: float = 3600,
) -> Tuple[Tuple[float, float], Tuple[float, float]]:
    """
    Advance iceberg position by one time step.
    
    Returns:
        new_position: (lat, lon) in degrees
        velocity: (dlat, dlon) in degrees
    """
    dlat, dlon = calculate_velocity(
        position, current_velocity, wind_velocity, ice_drift, wind_factor, dt
    )
    new_lat = position[0] + dlat
    new_lon = position[1] + dlon
    return ((new_lat, new_lon), (dlat, dlon))


def simulate_trajectory(
    initial_position: Tuple[float, float],
    current_velocities: List[Tuple[float, float]],
    wind_velocities: List[Tuple[float, float]],
    ice_drifts: List[Tuple[float, float]],
    timesteps: int = 24,
    wind_factor: float = 0.01,
    dt: float = 3600,
    add_noise: bool = True,
    noise_level: float = 0.05,
) -> List[Dict[str, Any]]:
    """
    Simulate an iceberg trajectory over multiple timesteps.
    
    Args:
        initial_position: Starting (lat, lon) in degrees
        current_velocities: List of current velocity tuples (one per timestep)
        wind_velocities: List of wind velocity tuples (one per timestep)
        ice_drifts: List of ice drift tuples (one per timestep)
        timesteps: Number of timesteps to simulate
        wind_factor: Wind influence factor
        dt: Time step in seconds (default 1 hour)
        add_noise: Whether to add stochastic uncertainty
        noise_level: Standard deviation of noise as fraction of velocity
    
    Returns:
        List of dicts with 'timestamp', 'latitude', 'longitude' keys
    """
    position = [float(initial_position[0]), float(initial_position[1])]
    trajectory = []
    
    for t in range(timesteps):
        # Get current environmental factors (cycling or from lists)
        ct = t % len(current_velocities)
        wt = t % len(wind_velocities)
        it = t % len(ice_drifts)
        
        # Calculate velocity directly (avoid advect_iceberg which has return value issues)
        dlat, dlon = calculate_velocity(
            (position[0], position[1]),
            current_velocities[ct],
            wind_velocities[wt],
            ice_drifts[it],
            wind_factor,
            dt,
        )
        
        # Update position
        position[0] += dlat
        position[1] += dlon
        
        # Add stochastic noise - scaled to displacement magnitude
        if add_noise:
            # Noise proportional to displacement, not velocity
            noise_sigma_lat = noise_level * abs(dlat) * 0.1
            noise_sigma_lon = noise_level * abs(dlon) * 0.1
            # Clamp noise to reasonable maximum (5% of displacement)
            noise_sigma_lat = min(noise_sigma_lat, abs(dlat) * 0.5)
            noise_sigma_lon = min(noise_sigma_lon, abs(dlon) * 0.5)
            noise_lat = np.random.normal(0, noise_sigma_lat)
            noise_lon = np.random.normal(0, noise_sigma_lon)
            position[0] += noise_lat
            position[1] += noise_lon
        
        trajectory.append({
            'timestamp': t * dt,  # seconds
            'latitude': round(position[0], 6),
            'longitude': round(position[1], 6),
        })
    
    return trajectory


def generate_ensemble(
    initial_positions: List[Tuple[float, float]],
    grid: Any,  # EnvironmentalGrid object
    hours: int = 72,
    num_simulations: int = 300,
    wind_factor: float = 0.01,
) -> Dict[str, Any]:
    """
    Generate Monte Carlo ensemble of iceberg trajectories.
    
    Args:
        initial_positions: List of initial (lat, lon) positions
        grid: EnvironmentalGrid with current/wind data
        hours: Prediction hours
        num_simulations: Number of Monte Carlo samples
        wind_factor: Wind influence factor
    
    Returns:
        Dict with trajectories, probability grid, confidence, uncertainty radius
    """
    timesteps = max(1, hours // 1)  # 1-hour timesteps
    
    # Prepare environmental data arrays indexed by position
    lats = _get_grid(grid, 'latitudes')  # shape (n_lat, n_lon)
    lons = _get_grid(grid, 'longitudes')  # shape (n_lat, n_lon)
    n_lat, n_lon = lats.shape
    
    all_trajectories = []
    
    for init_pos in initial_positions:
        # Find nearest grid cell index
        lat_idx = min(max(int(np.argmin(np.abs(lats[:, 0] - init_pos[0]))), 0), n_lat - 1)
        lon_idx = min(max(int(np.argmin(np.abs(lats[0, :] - init_pos[1]))), 0), n_lon - 1)
        
        # Extract environmental profiles for this position
        current_speed = _get_2d(grid, 'current_speed', lat_idx, lon_idx)
        current_dir = np.radians(_get_2d(grid, 'current_direction', lat_idx, lon_idx))
        wind_speed = _get_2d(grid, 'wind_speed', lat_idx, lon_idx)
        wind_dir = np.radians(_get_2d(grid, 'wind_direction', lat_idx, lon_idx))
        ice_speed = _get_2d(grid, 'ice_drift_speed', lat_idx, lon_idx)
        ice_dir = np.radians(_get_2d(grid, 'ice_drift_direction', lat_idx, lon_idx))
        
        # Current velocity components (m/s)
        current_u = current_speed * np.cos(current_dir)
        current_v = current_speed * np.sin(current_dir)
        
        # Wind velocity components (m/s) - wind factor will be applied
        wind_u = wind_speed * np.cos(wind_dir)
        wind_v = wind_speed * np.sin(wind_dir)
        
        # Ice drift components (m/s)
        ice_u = ice_speed * np.cos(np.radians(ice_dir))
        ice_v = ice_speed * np.sin(np.radians(ice_dir))
        
        # Generate multiple simulations with perturbed initial positions
        traj_for_pos = []
        for sim_idx in range(num_simulations // len(initial_positions)):
            # Perturb initial position slightly
            perturb_lat = np.random.normal(0, 0.1)  # ~0.1 degree perturbation
            perturb_lon = np.random.normal(0, 0.1)
            perturbed_pos = (init_pos[0] + perturb_lat, init_pos[1] + perturb_lon)
            
            # Add perturbation to environmental variables
            current_perturb = np.random.normal(0, 0.05) * current_speed
            wind_perturb = np.random.normal(0, 0.1) * wind_speed
            ice_perturb = np.random.normal(0, 0.1) * ice_speed
            
            perturbed_current = (current_u + current_perturb, current_v + current_perturb)
            perturbed_wind = (wind_u + wind_perturb, wind_v + wind_perturb)
            perturbed_ice = (ice_u + ice_perturb, ice_v + ice_perturb)
            
            # Simulate trajectory
            trajectory = simulate_trajectory(
                perturbed_pos,
                [perturbed_current],  # Simplified: use same current throughout
                [perturbed_wind],
                [perturbed_ice],
                timesteps=timesteps,
                wind_factor=wind_factor,
                add_noise=True,
                noise_level=0.03,
            )
            traj_for_pos.extend(trajectory)
        
        all_trajectories.extend(traj_for_pos)
    
    # Build probability grid
    probability_grid = build_probability_grid(all_trajectories, lats, lons)
    
    # Calculate confidence and uncertainty
    confidence = calculate_confidence(all_trajectories, lats, lons)
    uncertainty_radius = calculate_uncertainty_radius(all_trajectories, initial_positions[0] if initial_positions else (0, 0))
    
    return {
        'trajectories': all_trajectories,
        'probability_grid': probability_grid,
        'confidence': confidence,
        'uncertainty_radius_km': uncertainty_radius,
    }


def build_probability_grid(trajectories, lats, lons, resolution_deg=0.1):
    """Build a probability density grid from trajectories."""
    n_lat, n_lon = lats.shape
    
    # Calculate grid spacing, handle edge cases
    lat_spacing = lats[1, 0] - lats[0, 0] if n_lat > 1 else 1.0
    lon_spacing = lons[0, 1] - lons[0, 0] if n_lon > 1 else 1.0
    
    # Avoid division by zero
    if abs(lat_spacing) < 1e-10:
        lat_spacing = 1.0
    if abs(lon_spacing) < 1e-10:
        lon_spacing = 1.0
    
    grid = np.zeros((n_lat, n_lon))
    count = np.zeros((n_lat, n_lon))
    
    for traj in trajectories:
        lat = traj['latitude']
        lon = traj['longitude']
        
        # Find nearest grid cell with bounds checking
        try:
            lat_idx = int((lat - lats[0, 0]) / lat_spacing)
            lon_idx = int((lon - lons[0, 0]) / lon_spacing)
        except (ZeroDivisionError, OverflowError, ValueError):
            continue
        
        # Clamp to grid bounds
        lat_idx = max(0, min(n_lat - 1, lat_idx))
        lon_idx = max(0, min(n_lon - 1, lon_idx))
        
        grid[lat_idx, lon_idx] += 1
        count[lat_idx, lon_idx] += 1
    
    # Normalize to probability
    with np.errstate(divide='ignore', invalid='ignore'):
        probability = np.where(count > 0, grid / count, 0)
    
    return probability


def calculate_confidence(trajectories, lats, lons):
    """Calculate confidence score based on trajectory concentration."""
    if not trajectories:
        return 0.0
    
    # Count how many unique grid cells have trajectory points
    visited = set()
    for traj in trajectories:
        lat = traj['latitude']
        lon = traj['longitude']
        lat_idx = min(max(int((lat - lats[0, 0]) / (lats[1, 0] - lats[0, 0])), 0), len(lats) - 1)
        lon_idx = min(max(int((lon - lons[0, 0]) / (lons[1, 0] - lons[0, 0])), 0), len(lons) - 1)
        visited.add((lat_idx, lon_idx))
    
    total_cells = len(lats) * len(lons)
    coverage = len(visited) / total_cells
    
    # Confidence: higher when trajectories are concentrated (lower coverage = higher confidence)
    # Inverse relationship: confidence high when trajectories cluster
    confidence = max(0, 1.0 - coverage)
    return round(confidence, 3)


def calculate_uncertainty_radius(trajectories, initial_pos, resolution_deg=0.1):
    """Calculate uncertainty radius in km from trajectory spread."""
    if not trajectories:
        return 0.0
    
    lats_t = np.array([t['latitude'] for t in trajectories])
    lons_t = np.array([t['longitude'] for t in trajectories])
    
    # Radius as std dev of final positions
    lat_std = np.std(lats_t)
    lon_std = np.std(lons_t)
    
    # Convert to km
    lat_radius_km = lat_std * 111.32
    lon_radius_km = lon_std * 111.32 * np.cos(np.radians(np.mean([t['latitude'] for t in trajectories])))
    
    # Elliptical radius (geometric mean)
    radius = np.sqrt(lat_radius_km**2 + lon_radius_km**2)
    return round(radius, 1)
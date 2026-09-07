"""
Monte Carlo Ensemble & Trajectory Cone Engine for SIH Antarctic Navigation.

Quantifies trajectory uncertainty by generating an ensemble of 100-500 perturbed trajectories per iceberg.
Computes probability density across the 9km spatial grid and identifies risk probability levels:
- <10% : Low probability
- 10–30% : Moderate probability
- 30–60% : High probability
- >60% : Very High probability
"""

import numpy as np
from typing import List, Dict, Tuple, Any
from backend.models.lagrangian import simulate_trajectory

def generate_iceberg_ensemble(
    initial_lat: float,
    initial_lon: float,
    data_provider: Any,
    hours: int = 72,
    num_simulations: int = 300,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Generates a Monte Carlo ensemble of trajectories for an iceberg and computes cell entry probabilities.
    """
    np.random.seed(seed)
    rows, cols = data_provider.get_grid_dimensions()
    min_lat, max_lat, min_lon, max_lon = data_provider.get_bounds()

    grid_counts = np.zeros((rows, cols), dtype=float)
    ensemble_trajectories = []
    final_positions = []

    # Run Monte Carlo iterations with perturbed initial conditions & dynamics
    for sim_idx in range(num_simulations):
        # Perturb initial position (satellite telemetry noise ~ 1.5 km)
        lat_offset = np.random.normal(0, 0.015)
        lon_offset = np.random.normal(0, 0.025)
        start_lat = initial_lat + lat_offset
        start_lon = initial_lon + lon_offset

        # Perturb physical drag parameters
        w_factor = np.random.uniform(0.015, 0.035)
        ice_factor = np.random.uniform(0.25, 0.45)
        noise_sigma = np.random.uniform(0.02, 0.06)

        path = simulate_trajectory(
            start_lat, start_lon, data_provider,
            hours=float(hours), dt_hours=2.0,
            wind_factor=w_factor, ice_factor=ice_factor, noise_sigma=noise_sigma
        )

        # Store every 5th trajectory for lightweight UI visualization
        if sim_idx % max(1, num_simulations // 30) == 0:
            ensemble_trajectories.append(path)

        # Record visited grid cells for spatial probability map
        visited_cells = set()
        for pt in path:
            p_lat = pt["latitude"]
            p_lon = pt["longitude"]
            r = int(np.clip((max_lat - p_lat) / (max_lat - min_lat) * (rows - 1), 0, rows - 1))
            c = int(np.clip((p_lon - min_lon) / (max_lon - min_lon) * (cols - 1), 0, cols - 1))
            visited_cells.add((r, c))

        for (r, c) in visited_cells:
            grid_counts[r, c] += 1.0

        if path:
            final_pt = path[-1]
            final_positions.append((final_pt["latitude"], final_pt["longitude"]))

    # Probability density matrix (0.0 to 1.0)
    prob_grid = (grid_counts / float(num_simulations)).tolist()

    # Calculate ensemble spread / uncertainty radius in km at endpoint
    if final_positions:
        lats = [p[0] for p in final_positions]
        lons = [p[1] for p in final_positions]
        mean_lat, mean_lon = np.mean(lats), np.mean(lons)
        d_lats = (np.array(lats) - mean_lat) * 111.139
        d_lons = (np.array(lons) - mean_lon) * 111.139 * np.cos(np.radians(mean_lat))
        spreads = np.hypot(d_lats, d_lons)
        uncertainty_radius_km = float(np.percentile(spreads, 90)) # 90th percentile radius
    else:
        uncertainty_radius_km = 12.5

    # Confidence score (decays with prediction hours and spread)
    confidence = float(np.clip(100.0 - (hours * 0.35) - (uncertainty_radius_km * 0.4), 45.0, 96.0))

    return {
        "trajectories": ensemble_trajectories,
        "probability_grid": prob_grid,
        "confidence": round(confidence, 1),
        "uncertainty_radius_km": round(uncertainty_radius_km, 1)
    }

def aggregate_multi_iceberg_probabilities(
    icebergs: List[Dict[str, Any]],
    data_provider: Any,
    hours: int = 72,
    num_simulations: int = 200
) -> Dict[str, Any]:
    """
    Runs Monte Carlo ensemble for multiple icebergs and aggregates total cell entry probability.
    """
    rows, cols = data_provider.get_grid_dimensions()
    combined_prob = np.zeros((rows, cols), dtype=float)
    all_trajectories = {}
    total_conf = []
    total_radii = []

    for idx, berg in enumerate(icebergs):
        res = generate_iceberg_ensemble(
            berg["latitude"], berg["longitude"],
            data_provider, hours=hours, num_simulations=num_simulations, seed=42 + idx
        )

        all_trajectories[berg["id"]] = res["trajectories"]
        prob_arr = np.array(res["probability_grid"])
        # Probabilistic OR union: P(A u B) = 1 - (1 - P_A)*(1 - P_B)
        combined_prob = 1.0 - (1.0 - combined_prob) * (1.0 - prob_arr)
        total_conf.append(res["confidence"])
        total_radii.append(res["uncertainty_radius_km"])

    avg_conf = float(np.mean(total_conf)) if total_conf else 85.0
    avg_radius = float(np.mean(total_radii)) if total_radii else 15.0

    return {
        "trajectories": all_trajectories,
        "probability_grid": combined_prob.tolist(),
        "confidence": round(avg_conf, 1),
        "uncertainty_radius_km": round(avg_radius, 1)
    }

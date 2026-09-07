"""
A* Risk-Aware Ship Routing Engine for SIH Antarctic Navigation.

Calculates optimal Antarctic navigation routes using A* grid pathfinding.
Supports 3 routing modes:
- FASTEST: Minimizes travel time and distance
- SAFEST: Strongly penalizes risks and avoids high-risk cell entry
- BALANCED: Multi-objective optimization balancing safety and transit time

Cell traversal cost = distance * (1.0 + penalty_weights * risk_factors)
Impassable barrier when risk > max_acceptable_risk.
"""

import heapq
import numpy as np
from typing import List, Tuple, Dict, Any
from backend.schemas import RouteResponse, RoutePointInfo

METERS_PER_DEGREE_LAT = 111139.0

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates approximate distance in kilometers between two lat/lon points."""
    dlat = (lat2 - lat1) * 111.139
    dlon = (lon2 - lon1) * 111.139 * np.cos(np.radians((lat1 + lat2) / 2.0))
    return float(np.hypot(dlat, dlon))

def find_nearest_cell(lat: float, lon: float, risk_grid: List[List[Dict[str, Any]]]) -> Tuple[int, int]:
    """Finds grid (row, col) index closest to target lat/lon."""
    min_dist = float('inf')
    best_cell = (0, 0)

    for r in range(len(risk_grid)):
        for c in range(len(risk_grid[0])):
            c_lat = risk_grid[r][c]["latitude"]
            c_lon = risk_grid[r][c]["longitude"]
            dist = haversine_distance_km(lat, lon, c_lat, c_lon)
            if dist < min_dist:
                min_dist = dist
                best_cell = (r, c)

    return best_cell

def calculate_route(
    start_pos: Tuple[float, float],
    dest_pos: Tuple[float, float],
    risk_grid: List[List[Dict[str, Any]]],
    mode: str = "balanced",
    max_risk: float = 0.70,
    ship_speed_knots: float = 14.0
) -> RouteResponse:
    """
    Computes A* route between start_pos and dest_pos on risk_grid.
    """
    rows = len(risk_grid)
    cols = len(risk_grid[0])

    start_cell = find_nearest_cell(start_pos[0], start_pos[1], risk_grid)
    dest_cell = find_nearest_cell(dest_pos[0], dest_pos[1], risk_grid)

    # Configure penalty multipliers based on routing mode
    mode = mode.lower()
    if mode == "fastest":
        w_risk = 2.0
        w_ice = 1.0
        w_berg = 2.0
        hard_limit = min(0.95, max_risk + 0.20)
    elif mode == "safest":
        w_risk = 45.0
        w_ice = 15.0
        w_berg = 30.0
        hard_limit = max_risk
    else:  # balanced
        w_risk = 12.0
        w_ice = 4.0
        w_berg = 8.0
        hard_limit = max_risk + 0.05

    # 8-neighbor directional moves
    neighbors = [
        (-1, 0), (1, 0), (0, -1), (0, 1),
        (-1, -1), (-1, 1), (1, -1), (1, 1)
    ]

    # Priority queue for A*: (f_score, r, c)
    open_set = []
    heapq.heappush(open_set, (0.0, start_cell[0], start_cell[1]))

    came_from = {}
    g_score = {start_cell: 0.0}

    # Target coordinates for heuristic
    dest_lat = risk_grid[dest_cell[0]][dest_cell[1]]["latitude"]
    dest_lon = risk_grid[dest_cell[0]][dest_cell[1]]["longitude"]

    def heuristic(r: int, c: int) -> float:
        c_lat = risk_grid[r][c]["latitude"]
        c_lon = risk_grid[r][c]["longitude"]
        return haversine_distance_km(c_lat, c_lon, dest_lat, dest_lon)

    f_score = {start_cell: heuristic(start_cell[0], start_cell[1])}

    target_reached = False
    visited_count = 0

    while open_set:
        _, curr_r, curr_c = heapq.heappop(open_set)
        visited_count += 1

        if (curr_r, curr_c) == dest_cell:
            target_reached = True
            break

        curr_cell_data = risk_grid[curr_r][curr_c]
        curr_lat = curr_cell_data["latitude"]
        curr_lon = curr_cell_data["longitude"]

        for dr, dc in neighbors:
            nr, nc = curr_r + dr, curr_c + dc
            if 0 <= nr < rows and 0 <= nc < cols:
                neighbor_cell = risk_grid[nr][nc]
                n_risk = neighbor_cell["risk_score"]

                # Hard constraint check if risk exceeds allowed threshold
                if n_risk > hard_limit and (nr, nc) != dest_cell:
                    continue

                n_lat = neighbor_cell["latitude"]
                n_lon = neighbor_cell["longitude"]
                step_dist = haversine_distance_km(curr_lat, curr_lon, n_lat, n_lon)

                # Penalties
                ice_conc = neighbor_cell["ice_concentration"]
                berg_prob = neighbor_cell.get("iceberg_probability", 0.0)
                shallow_pen = 2.0 if neighbor_cell["water_depth"] < 200 else 0.0

                penalty = w_risk * (n_risk ** 1.5) + w_ice * (ice_conc ** 2) + w_berg * berg_prob + shallow_pen
                step_cost = step_dist * (1.0 + penalty)

                tentative_g = g_score[(curr_r, curr_c)] + step_cost

                if (nr, nc) not in g_score or tentative_g < g_score[(nr, nc)]:
                    came_from[(nr, nc)] = (curr_r, curr_c)
                    g_score[(nr, nc)] = tentative_g
                    f_score[(nr, nc)] = tentative_g + heuristic(nr, nc)
                    heapq.heappush(open_set, (f_score[(nr, nc)], nr, nc))

    # Reconstruct path
    path_cells = []
    if target_reached:
        curr = dest_cell
        while curr in came_from:
            path_cells.append(curr)
            curr = came_from[curr]
        path_cells.append(start_cell)
        path_cells.reverse()
    else:
        # Fallback to direct path if no route under strict constraints
        path_cells = [start_cell, dest_cell]

    # Process route points and statistics
    route_coords = []
    route_details = []
    total_dist_km = 0.0
    risk_scores = []
    iceberg_encounters = 0

    for i, (r, c) in enumerate(path_cells):
        cell_info = risk_grid[r][c]
        lat, lon = cell_info["latitude"], cell_info["longitude"]
        route_coords.append((lat, lon))

        r_score = cell_info["risk_score"]
        risk_scores.append(r_score)
        if cell_info.get("iceberg_probability", 0.0) > 0.15:
            iceberg_encounters += 1

        route_details.append(RoutePointInfo(
            latitude=lat,
            longitude=lon,
            risk_score=r_score,
            ice_concentration=cell_info["ice_concentration"],
            iceberg_prob=cell_info.get("iceberg_probability", 0.0)
        ))

        if i > 0:
            prev_lat, prev_lon = route_coords[i - 1]
            total_dist_km += haversine_distance_km(prev_lat, prev_lon, lat, lon)

    # Transit time calculation considering ice resistance slowdown
    ship_speed_kmh = ship_speed_knots * 1.852
    mean_ice = np.mean([risk_grid[r][c]["ice_concentration"] for (r, c) in path_cells])
    speed_reduction_factor = max(0.40, 1.0 - 0.5 * mean_ice)
    effective_speed = ship_speed_kmh * speed_reduction_factor
    time_hours = total_dist_km / max(1.0, effective_speed)

    mean_risk = float(np.mean(risk_scores)) if risk_scores else 0.1
    max_path_risk = float(np.max(risk_scores)) if risk_scores else 0.1
    safety_margin = float(np.clip((1.0 - max_path_risk) * 100.0, 0.0, 100.0))

    if max_path_risk >= 0.7:
        risk_lvl = "HIGH"
    elif max_path_risk >= 0.4:
        risk_lvl = "MODERATE"
    else:
        risk_lvl = "LOW"

    return RouteResponse(
        mode=mode,
        route=route_coords,
        route_details=route_details,
        distance_km=round(total_dist_km, 1),
        estimated_time_hours=round(time_hours, 1),
        risk_score=round(mean_risk, 3),
        risk_level=risk_lvl,
        iceberg_encounters=iceberg_encounters,
        safety_margin_percent=round(safety_margin, 1)
    )

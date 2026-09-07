"""
Routing Engine for Antarctic Ship Routing.

Implements A* pathfinding on a grid with risk-aware cost function.
Supports three routing modes: FASTEST, SAFEST, BALANCED.

Route cost function:
  route_cost = distance_cost + risk_penalty + sea_ice_penalty + 
               iceberg_penalty + shallow_water_penalty
"""

from dataclasses import dataclass

import numpy as np
import heapq
from typing import List, Tuple, Dict, Any, Optional


@dataclass
class RouteResult:
    """Result from a routing calculation."""
    route: List[Tuple[float, float]]  # (lat, lon) waypoints
    distance_km: float
    estimated_time_hours: float
    risk_score: float  # average risk along route
    iceberg_encounters: int
    safety_margin: float  # percentage of route below max risk
    mode: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'route': self.route,
            'distance_km': round(self.distance_km, 1),
            'estimated_time_hours': round(self.estimated_time_hours, 1),
            'risk_score': round(self.risk_score, 3),
            'iceberg_encounters': self.iceberg_encounters,
            'safety_margin': round(self.safety_margin, 1),
            'mode': self.mode,
        }


def _get_array(grid: Any, key: str, default_idx: int = 0) -> np.ndarray:
    """Get a 2D numpy array from grid (dict or object)."""
    data = grid[key] if isinstance(grid, dict) else getattr(grid, key)
    return np.array(data)


def _get_2d(grid: Any, key: str, i: int, j: int) -> float:
    """Get a 2D grid cell value."""
    arr = _get_array(grid, key)
    return float(arr[i, j])


from dataclasses import dataclass


class GridRouter:
    """A* router on an environmental grid with risk-aware costs."""
    
    def __init__(self, grid: Any, weights: Optional[Dict[str, float]] = None):
        """
        Initialize router with environmental grid.
        
        Args:
            grid: EnvironmentalGrid object or dict with grid data
            weights: MCDM weights for risk calculation
        """
        self.grid = grid
        self.weights = weights or {'iceberg_risk': 0.35, 'sea_ice_risk': 0.25,
                                   'current_risk': 0.10, 'wind_risk': 0.10,
                                   'wave_risk': 0.10, 'bathymetry_risk': 0.10}
        
        # Pre-compute risk map
        self.risk_map = self._compute_risk_map()
        
        # Grid resolution - handle both dict and object formats
        if isinstance(grid, dict):
            lats = np.array(grid['latitudes'])
            lons = np.array(grid['longitudes'])
            self.n_lat, self.n_lon = lats.shape
            self.lat_step = abs(lats[1, 0] - lats[0, 0])
            self.lon_step = abs(lons[0, 1] - lons[0, 0])
        else:
            self.n_lat, self.n_lon = grid.latitudes.shape
            self.lat_step = abs(grid.latitudes[1, 0] - grid.latitudes[0, 0])
        
        # Earth radius for distance calculations
        self.R = 6371.0  # km
    
    def _world_to_grid(self, lat: float, lon: float) -> Tuple[int, int]:
        """Convert world coordinates to grid indices."""
        lats = _get_array(self.grid, 'latitudes')
        lons = _get_array(self.grid, 'longitudes')
        lat_idx = int((lat - lats[0, 0]) / self.lat_step)
        lon_idx = int((lon - lons[0, 0]) / self.lon_step)
        
        lat_idx = max(0, min(self.n_lat - 1, lat_idx))
        lon_idx = max(0, min(self.n_lon - 1, lon_idx))
        
        return lat_idx, lon_idx
    
    def _grid_to_world(self, lat_idx: int, lon_idx: int) -> Tuple[float, float]:
        """Convert grid indices to world coordinates."""
        lats = _get_array(self.grid, 'latitudes')
        lons = _get_array(self.grid, 'longitudes')
        lat = float(lats[lat_idx, lon_idx])
        lon = float(lons[lat_idx, lon_idx])
        return lat, lon
    
    def _compute_risk_map(self) -> np.ndarray:
        """Pre-compute the total risk map for the grid."""
        from .risk_engine import calculate_total_risk
        result = calculate_total_risk(self.grid, self.weights)
        return np.array(result['total_risk'], dtype=float)
    
    def _heuristic(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Heuristic: great-circle distance in km."""
        dlat = np.radians(lat2 - lat1)
        dlon = np.radians(lon2 - lon1)
        a = np.sin(dlat / 2) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2) ** 2
        c = 2 * np.arcsin(np.sqrt(a))
        return self.R * c
    
    def _cell_cost(self, lat_idx: int, lon_idx: int, 
                   target_lat_idx: int, target_lon_idx: int,
                   mode: str = 'balanced',
                   max_risk: float = 1.0) -> float:
        """
        Calculate traversal cost for a grid cell.
        
        Cost = distance_cost + risk_penalty + other penalties
        """
        # Distance cost (great circle to target)
        lat, lon = self._grid_to_world(lat_idx, lon_idx)
        target_lat, target_lon = self._grid_to_world(target_lat_idx, target_lon_idx)
        dist_cost = self._heuristic(lat, lon, target_lat, target_lon)
        
        # Risk penalty (based on pre-computed risk map)
        cell_risk = self.risk_map[lat_idx, lon_idx]
        
        if mode == 'safest':
            if cell_risk > max_risk:
                return dist_cost + 100.0
            risk_penalty = cell_risk * cell_risk * 50.0
        elif mode == 'fastest':
            risk_penalty = cell_risk * 5.0
        else:  # balanced
            if cell_risk > max_risk:
                return dist_cost + 50.0
            risk_penalty = cell_risk * cell_risk * 20.0
        
        # Sea ice penalty
        ice_penalty = 0.0
        ice_conc = _get_2d(self.grid, 'ice_concentration', lat_idx, lon_idx)
        if ice_conc > 0.6:
            ice_penalty = 15.0 * ice_conc
        
        # Iceberg penalty
        iceberg_penalty = 0.0
        if cell_risk > 0.6:
            iceberg_penalty = 20.0
        
        # Shallow water penalty
        depth_penalty = 0.0
        water_depth = _get_2d(self.grid, 'water_depth', lat_idx, lon_idx)
        if water_depth < 500:
            depth_penalty = (500 - water_depth) * 0.1
        
        total_cost = dist_cost + risk_penalty + ice_penalty + iceberg_penalty + depth_penalty
        return max(total_cost, 0.01)
    
    def find_route(self, start_lat: float, start_lon: float,
                   dest_lat: float, dest_lon: float,
                   mode: str = 'balanced',
                   max_risk: float = 0.6,
                   ship_speed_kn: float = 15) -> RouteResult:
        """
        Find a route from start to destination using A*.
        """
        start_idx = self._world_to_grid(start_lat, start_lon)
        dest_idx = self._world_to_grid(dest_lat, dest_lon)
        
        open_set = []
        heapq.heappush(open_set, (0.0, start_idx[0], start_idx[1]))
        
        came_from = {}
        g_score = {(start_idx[0], start_idx[1]): 0.0}
        f_score = {(start_idx[0], start_idx[1]): self._heuristic(start_lat, start_lon, dest_lat, dest_lon)}
        
        neighbors = [
            (-1, -1), (-1, 0), (-1, 1),
            (0, -1),           (0, 1),
            (1, -1),  (1, 0),  (1, 1)
        ]
        
        closed_set = set()
        
        while open_set:
            current_f, current_lat, current_lon = heapq.heappop(open_set)
            current = (current_lat, current_lon)
            
            if current in closed_set:
                continue
            closed_set.add(current)
            
            if current == dest_idx:
                return self._reconstruct_path(came_from, current, mode, max_risk, ship_speed_kn)
            
            for dlat, dlon in neighbors:
                neighbor_lat = current_lat + dlat
                neighbor_lon = current_lon + dlon
                
                if (neighbor_lat < 0 or neighbor_lat >= self.n_lat or
                    neighbor_lon < 0 or neighbor_lon >= self.n_lon):
                    continue
                
                neighbor = (neighbor_lat, neighbor_lon)
                if neighbor in closed_set:
                    continue
                
                step_cost = self._cell_cost(current_lat, current_lon, dest_idx[0], dest_idx[1], mode, max_risk)
                
                tentative_g = g_score[current] + step_cost
                
                if neighbor not in g_score or tentative_g < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    n_lat, n_lon = self._grid_to_world(neighbor_lat, neighbor_lon)
                    h = self._heuristic(n_lat, n_lon, dest_lat, dest_lon)
                    f = tentative_g + h
                    
                    heapq.heappush(open_set, (f, neighbor_lat, neighbor_lon))
                    f_score[neighbor] = f
        
        return self._create_direct_route(start_idx, dest_idx, mode, max_risk)
    
    def _reconstruct_path(self, came_from, current_idx, mode, max_risk, ship_speed_kn: float = 15.0) -> RouteResult:
        """Reconstruct path from came_from dict."""
        path = [current_idx]
        while current_idx in came_from:
            current_idx = came_from[current_idx]
            path.append(current_idx)
        path.reverse()
        
        route = [self._grid_to_world(lat, lon) for lat, lon in path]
        
        distance_km = 0.0
        total_risk = 0.0
        iceberg_cells = 0
        
        for i in range(len(path) - 1):
            lat1, lon1 = self._grid_to_world(path[i][0], path[i][1])
            lat2, lon2 = self._grid_to_world(path[i+1][0], path[i+1][1])
            distance_km += self._heuristic(lat1, lon1, lat2, lon2)
            total_risk += self.risk_map[path[i][0], path[i][1]]
            
            if self.risk_map[path[i][0], path[i][1]] > 0.6:
                iceberg_cells += 1
        
        if ship_speed_kn > 0 and distance_km > 0:
            estimated_time_hours = distance_km / (ship_speed_kn * 1.852)
        else:
            estimated_time_hours = 0.0
        
        avg_risk = total_risk / len(path) if path else 0.0
        
        cells_below_risk = sum(1 for idx in path if self.risk_map[idx] < max_risk)
        safety_margin = (cells_below_risk / len(path) * 100) if path else 100.0
        
        return RouteResult(
            route=route,
            distance_km=round(distance_km, 1),
            estimated_time_hours=round(estimated_time_hours, 1),
            risk_score=round(avg_risk, 3),
            iceberg_encounters=iceberg_cells,
            safety_margin=round(safety_margin, 1),
            mode=mode,
        )
    
    def _create_direct_route(self, start_idx, dest_idx, mode, max_risk) -> RouteResult:
        """Create a direct route when A* fails."""
        start_lat, start_lon = self._grid_to_world(start_idx[0], start_idx[1])
        dest_lat, dest_lon = self._grid_to_world(dest_idx[0], dest_idx[1])
        
        route = [(start_lat, start_lon), (dest_lat, dest_lon)]
        
        distance_km = self._heuristic(start_lat, start_lon, dest_lat, dest_lon)
        estimated_time_hours = distance_km / (max(0.1, ship_speed_kn) * 1.852)
        
        start_risk = float(self.risk_map[start_idx[0], start_idx[1]])
        end_risk = float(self.risk_map[dest_idx[0], dest_idx[1]])
        avg_risk = (start_risk + end_risk) / 2.0
        
        cells_below_risk = 0
        if start_risk < max_risk:
            cells_below_risk += 1
        if end_risk < max_risk:
            cells_below_risk += 1
        safety_margin = (cells_below_risk / max(1, len(route))) * 100.0
        
        return RouteResult(
            route=route,
            distance_km=round(distance_km, 1),
            estimated_time_hours=round(estimated_time_hours, 1),
            risk_score=round(avg_risk, 3),
            iceberg_encounters=0,
            safety_margin=round(safety_margin, 1),
            mode=mode,
        )
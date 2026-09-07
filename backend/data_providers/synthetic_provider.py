"""
Synthetic Antarctic Environmental Data Provider for SIH Demonstration.

Generates a realistic, spatially-correlated 9 km x 9 km spatial grid over the Antarctic coastal ocean
(Prydz Bay / Bharati Station sector: -64.0°S to -70.0°S, 40.0°E to 80.0°E).
"""

import numpy as np
from typing import List, Tuple, Dict, Any
from backend.data_providers.interfaces import DataProvider

class SyntheticAntarcticDataProvider(DataProvider):
    def __init__(self, rows: int = 25, cols: int = 35, seed: int = 42):
        self.rows = rows
        self.cols = cols
        self.seed = seed
        self.min_lat = -70.0
        self.max_lat = -64.0
        self.min_lon = 40.0
        self.max_lon = 80.0
        
        # Grid lat/lon coordinate matrices
        self.lats = np.linspace(self.min_lat, self.max_lat, self.rows)
        self.lons = np.linspace(self.min_lon, self.max_lon, self.cols)
        self.lat_grid, self.lon_grid = np.meshgrid(self.lats, self.lons, indexing='ij')

        self.generate_synthetic_grid()

    def get_grid_dimensions(self) -> Tuple[int, int]:
        return (self.rows, self.cols)

    def get_bounds(self) -> Tuple[float, float, float, float]:
        return (self.min_lat, self.max_lat, self.min_lon, self.max_lon)

    def generate_synthetic_grid(self):
        np.random.seed(self.seed)

        # 1. Sea Ice Concentration (increases towards the south near ice shelf)
        # Lat range -64 to -70: normalized latitude from 0 (north) to 1 (south)
        norm_lat = (self.max_lat - self.lat_grid) / (self.max_lat - self.min_lat)
        noise = np.random.normal(0, 0.05, (self.rows, self.cols))
        self.ice_concentration = np.clip(0.1 + 0.75 * (norm_lat ** 1.3) + noise, 0.0, 0.98)

        # Ice drift (m/s)
        self.ice_drift_speed = np.clip(0.1 + 0.3 * (1 - norm_lat) + np.random.normal(0, 0.03, (self.rows, self.cols)), 0.02, 0.8)
        self.ice_drift_direction = (250 + 30 * np.sin(self.lon_grid * 0.1) + np.random.normal(0, 10, (self.rows, self.cols))) % 360

        # Ice type
        self.ice_type = np.where(self.ice_concentration > 0.7, "Multi-Year Fast Ice",
                       np.where(self.ice_concentration > 0.4, "Heavy Pack Ice",
                       np.where(self.ice_concentration > 0.15, "First-Year Pack", "Open Water")))

        # 2. Ocean Currents (ACC to the North, Coastal Counter-Current to South)
        u_curr = 0.25 * np.cos(np.radians(self.lat_grid)) + 0.15 * (1 - norm_lat) + np.random.normal(0, 0.02, (self.rows, self.cols))
        v_curr = -0.05 * np.sin(np.radians(self.lon_grid)) + np.random.normal(0, 0.02, (self.rows, self.cols))
        self.current_speed = np.hypot(u_curr, v_curr)
        self.current_direction = (np.degrees(np.arctan2(u_curr, v_curr)) + 360) % 360
        self.u_current = u_curr
        self.v_current = v_curr

        # 3. Wind / Weather (Katabatic offshore winds from south + westerlies north)
        u_wind = 15.0 * (1 - norm_lat) - 10.0 * norm_lat + np.random.normal(0, 3.0, (self.rows, self.cols)) # km/h
        v_wind = -20.0 * norm_lat + np.random.normal(0, 2.5, (self.rows, self.cols))
        self.wind_speed = np.clip(np.hypot(u_wind, v_wind), 5.0, 85.0)
        self.wind_direction = (np.degrees(np.arctan2(u_wind, v_wind)) + 360) % 360
        self.u_wind = u_wind / 3.6  # convert km/h to m/s for physics advection
        self.v_wind = v_wind / 3.6

        # 4. Wave height (attenuated by sea ice)
        base_wave = 4.5 * (1 - norm_lat) + 0.5
        self.wave_height = np.clip(base_wave * (1.0 - 0.85 * self.ice_concentration) + np.random.normal(0, 0.2, (self.rows, self.cols)), 0.2, 7.5)
        self.wave_direction = (280 + np.random.normal(0, 15, (self.rows, self.cols))) % 360

        # 5. Bathymetry (depth in meters: 3500m deep sea in North to 180m shelf in South)
        self.water_depth = np.clip(3200 * (1 - norm_lat**0.8) + 200 + np.random.normal(0, 50, (self.rows, self.cols)), 80, 4200)

        # 6. Historical Iceberg Density / Probability (Hotspots around -67°S, 55°E)
        dist_to_hotspot = np.hypot(self.lat_grid - (-67.2), self.lon_grid - 55.0)
        hotspot_density = np.exp(- (dist_to_hotspot / 4.5)**2)
        self.historical_iceberg_density = np.clip(0.15 + 0.7 * hotspot_density + np.random.normal(0, 0.04, (self.rows, self.cols)), 0.05, 0.95)
        self.historical_iceberg_prob = np.clip(self.historical_iceberg_density * 0.85 + 0.1, 0.0, 1.0)

    def get_cell_features(self, r: int, c: int) -> Dict[str, Any]:
        return {
            "row": r,
            "col": c,
            "latitude": float(self.lat_grid[r, c]),
            "longitude": float(self.lon_grid[r, c]),
            "ice_concentration": float(self.ice_concentration[r, c]),
            "ice_drift_speed": float(self.ice_drift_speed[r, c]),
            "ice_drift_direction": float(self.ice_drift_direction[r, c]),
            "ice_type": str(self.ice_type[r, c]),
            "current_speed": float(self.current_speed[r, c]),
            "current_direction": float(self.current_direction[r, c]),
            "wind_speed": float(self.wind_speed[r, c]),
            "wind_direction": float(self.wind_direction[r, c]),
            "wave_height": float(self.wave_height[r, c]),
            "wave_direction": float(self.wave_direction[r, c]),
            "water_depth": float(self.water_depth[r, c]),
            "historical_iceberg_density": float(self.historical_iceberg_density[r, c]),
            "historical_iceberg_probability": float(self.historical_iceberg_prob[r, c]),
            "u_current": float(self.u_current[r, c]),
            "v_current": float(self.v_current[r, c]),
            "u_wind": float(self.u_wind[r, c]),
            "v_wind": float(self.v_wind[r, c]),
        }

    def get_initial_icebergs(self) -> List[Dict[str, Any]]:
        return [
            {"id": "B-42", "latitude": -66.8, "longitude": 45.2, "size_category": "Large Tabular", "drift_speed": 0.6, "drift_direction": 225.0, "risk_rating": 88, "source": "Sentinel-1 SAR"},
            {"id": "C-19", "latitude": -65.9, "longitude": 52.1, "size_category": "Medium", "drift_speed": 0.4, "drift_direction": 210.0, "risk_rating": 65, "source": "MODIS Terra"},
            {"id": "A-81", "latitude": -67.4, "longitude": 61.5, "size_category": "Growler", "drift_speed": 0.5, "drift_direction": 250.0, "risk_rating": 42, "source": "CryoSat-2"},
            {"id": "D-07", "latitude": -66.2, "longitude": 68.4, "size_category": "Medium", "drift_speed": 0.3, "drift_direction": 200.0, "risk_rating": 58, "source": "Sentinel-1 SAR"},
            {"id": "E-33", "latitude": -68.1, "longitude": 74.0, "size_category": "Tabular", "drift_speed": 0.2, "drift_direction": 270.0, "risk_rating": 76, "source": "NIC Catalog"},
        ]

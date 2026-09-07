"""
Data Provider Interfaces for SIH Antarctic Intelligent Navigation System.

These abstract base classes define the standard interfaces for ingesting real scientific
datasets (Copernicus Marine, ERA5, IBCSO bathymetry, Satellite Sea Ice, US National Ice Center)
or synthetic simulation providers.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Any

class DataProvider(ABC):
    @abstractmethod
    def get_grid_dimensions(self) -> Tuple[int, int]:
        """Returns (num_rows, num_cols) of the geographic grid."""
        pass

    @abstractmethod
    def get_bounds(self) -> Tuple[float, float, float, float]:
        """Returns (min_lat, max_lat, min_lon, max_lon)."""
        pass

class SeaIceProvider(ABC):
    @abstractmethod
    def get_sea_ice_concentration(self, lat: float, lon: float, timestamp: float) -> float:
        """Returns sea ice concentration (0.0 to 1.0)."""
        pass

    @abstractmethod
    def get_ice_drift(self, lat: float, lon: float, timestamp: float) -> Tuple[float, float]:
        """Returns ice drift velocity vector (u_ms, v_ms)."""
        pass

class OceanCurrentProvider(ABC):
    @abstractmethod
    def get_current_velocity(self, lat: float, lon: float, timestamp: float) -> Tuple[float, float]:
        """Returns ocean current velocity vector (u_ms, v_ms)."""
        pass

class WeatherProvider(ABC):
    @abstractmethod
    def get_wind_velocity(self, lat: float, lon: float, timestamp: float) -> Tuple[float, float]:
        """Returns 10m wind velocity vector (u_ms, v_ms)."""
        pass

class WaveProvider(ABC):
    @abstractmethod
    def get_wave_parameters(self, lat: float, lon: float, timestamp: float) -> Tuple[float, float]:
        """Returns (significant_wave_height_m, wave_direction_deg)."""
        pass

class BathymetryProvider(ABC):
    @abstractmethod
    def get_water_depth(self, lat: float, lon: float) -> float:
        """Returns ocean depth in meters (positive down)."""
        pass

class IcebergProvider(ABC):
    @abstractmethod
    def get_tracked_icebergs(self) -> List[Dict[str, Any]]:
        """Returns list of currently tracked icebergs with initial positions and sizes."""
        pass

    @abstractmethod
    def get_historical_density_map(self) -> List[List[float]]:
        """Returns 2D grid of historical iceberg occurrence probability."""
        pass

"""
Pydantic Schemas for Antarctic Intelligent Ship Routing API.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Tuple, Dict, Any

class GridCell(BaseModel):
    row: int
    col: int
    latitude: float
    longitude: float
    ice_concentration: float = Field(..., ge=0.0, le=1.0, description="Sea ice concentration fraction 0-1")
    ice_drift_speed: float = Field(..., description="Ice drift speed in m/s")
    ice_drift_direction: float = Field(..., description="Ice drift direction in degrees")
    ice_type: str = Field("First Year", description="Ice type label")
    current_speed: float = Field(..., description="Ocean current speed in m/s")
    current_direction: float = Field(..., description="Current direction in degrees")
    wind_speed: float = Field(..., description="10m Wind speed in km/h")
    wind_direction: float = Field(..., description="Wind direction in degrees")
    wave_height: float = Field(..., description="Significant wave height in meters")
    wave_direction: float = Field(..., description="Wave direction in degrees")
    water_depth: float = Field(..., description="Bathymetric depth in meters")
    historical_iceberg_density: float = Field(..., ge=0.0, le=1.0)
    historical_iceberg_probability: float = Field(..., ge=0.0, le=1.0)
    risk_score: float = Field(0.0, ge=0.0, le=1.0, description="Calculated MCDM Risk score")
    risk_level: str = Field("LOW", description="LOW, MODERATE, HIGH, VERY HIGH, EXTREME")
    iceberg_probability: float = Field(0.0, ge=0.0, le=1.0, description="Monte Carlo cell entry probability")

class MCDMWeights(BaseModel):
    iceberg_risk: float = Field(0.35, ge=0.0, le=1.0)
    sea_ice_risk: float = Field(0.25, ge=0.0, le=1.0)
    ocean_current_risk: float = Field(0.10, ge=0.0, le=1.0)
    weather_wind_risk: float = Field(0.10, ge=0.0, le=1.0)
    wave_risk: float = Field(0.10, ge=0.0, le=1.0)
    bathymetry_risk: float = Field(0.10, ge=0.0, le=1.0)

class Iceberg(BaseModel):
    id: str
    latitude: float
    longitude: float
    size_category: str = Field("Medium", description="Growler, Small, Medium, Large, Tabular")
    drift_speed: float = Field(0.5, description="Drift speed in knots")
    drift_direction: float = Field(45.0, description="Direction in degrees")
    risk_rating: int = Field(80, ge=0, le=100)
    source: str = Field("Sentinel-1 SAR")

class TrajectoryPoint(BaseModel):
    timestamp: float
    latitude: float
    longitude: float

class TrajectoryConeZone(BaseModel):
    level: str = Field(..., description="low (<10%), moderate (10-30%), high (30-60%), very_high (>60%)")
    probability_min: float
    probability_max: float
    geometry_points: List[Tuple[float, float]]

class MonteCarloPredictionRequest(BaseModel):
    iceberg_ids: Optional[List[str]] = None
    prediction_hours: int = Field(72, ge=6, le=168)
    num_simulations: int = Field(300, ge=50, le=1000)

class MonteCarloPredictionResponse(BaseModel):
    prediction_hours: int
    num_simulations: int
    trajectories: Dict[str, List[List[TrajectoryPoint]]]
    probability_grid: List[List[float]]
    confidence: float
    uncertainty_radius_km: float

class RouteRequest(BaseModel):
    start: Tuple[float, float] = Field(..., description="[lat, lon] of start location")
    destination: Tuple[float, float] = Field(..., description="[lat, lon] of destination")
    mode: str = Field("balanced", description="fastest, safest, balanced")
    max_risk: float = Field(0.70, ge=0.1, le=1.0)
    ship_speed_knots: float = Field(14.0, ge=5.0, le=30.0)
    departure_time: str = Field("2026-09-07T12:00:00Z")

class RoutePointInfo(BaseModel):
    latitude: float
    longitude: float
    risk_score: float
    ice_concentration: float
    iceberg_prob: float

class RouteResponse(BaseModel):
    mode: str
    route: List[Tuple[float, float]]
    route_details: List[RoutePointInfo]
    distance_km: float
    estimated_time_hours: float
    risk_score: float
    risk_level: str
    iceberg_encounters: int
    safety_margin_percent: float

class RouteComparisonResponse(BaseModel):
    fastest: RouteResponse
    safest: RouteResponse
    balanced: RouteResponse

class SystemStatusResponse(BaseModel):
    status: str
    data_harmonized: bool
    grid_cells_count: int
    resolution_km: float
    data_sources: Dict[str, str]
    pipeline_stages: List[Dict[str, Any]]

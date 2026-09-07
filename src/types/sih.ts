export interface GridCellData {
  row: number;
  col: number;
  latitude: number;
  longitude: number;
  ice_concentration: number;
  ice_drift_speed: number;
  ice_drift_direction: number;
  ice_type: string;
  current_speed: number;
  current_direction: number;
  wind_speed: number;
  wind_direction: number;
  wave_height: number;
  wave_direction: number;
  water_depth: number;
  historical_iceberg_density: number;
  historical_iceberg_probability: number;
  risk_score: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH' | 'EXTREME';
  iceberg_probability: number;
  risk_components?: {
    iceberg_risk: number;
    sea_ice_risk: number;
    ocean_current_risk: number;
    weather_wind_risk: number;
    wave_risk: number;
    bathymetry_risk: number;
  };
}

export interface MCDMWeights {
  iceberg_risk: number;
  sea_ice_risk: number;
  ocean_current_risk: number;
  weather_wind_risk: number;
  wave_risk: number;
  bathymetry_risk: number;
}

export interface IcebergData {
  id: string;
  latitude: number;
  longitude: number;
  size_category: string;
  drift_speed: number;
  drift_direction: number;
  risk_rating: number;
  source: string;
}

export interface TrajectoryPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
}

export interface MonteCarloResponse {
  prediction_hours: number;
  num_simulations: number;
  trajectories: Record<string, TrajectoryPoint[][]>;
  probability_grid: number[][];
  confidence: number;
  uncertainty_radius_km: number;
}

export interface RoutePointInfo {
  latitude: number;
  longitude: number;
  risk_score: number;
  ice_concentration: number;
  iceberg_prob: number;
}

export interface RouteResponse {
  mode: 'fastest' | 'safest' | 'balanced';
  route: [number, number][];
  route_details: RoutePointInfo[];
  distance_km: number;
  estimated_time_hours: number;
  risk_score: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH' | 'EXTREME';
  iceberg_encounters: number;
  safety_margin_percent: number;
}

export interface RouteComparisonResponse {
  fastest: RouteResponse;
  safest: RouteResponse;
  balanced: RouteResponse;
}

export interface PipelineStage {
  stage: string;
  status: string;
  latency_ms: number;
  records?: number;
  features?: number;
  simulations?: number;
  weights_count?: number;
  dt_hours?: number;
  updated?: string;
  algorithm?: string;
}

export interface SystemStatus {
  status: string;
  data_harmonized: boolean;
  grid_cells_count: number;
  resolution_km: number;
  data_sources: Record<string, string>;
  pipeline_stages: PipelineStage[];
}

export interface DataLayersState {
  seaIce: boolean;
  oceanCurrents: boolean;
  wind: boolean;
  waves: boolean;
  historicalIcebergs: boolean;
  bathymetry: boolean;
  predictedTrajectories: boolean;
}

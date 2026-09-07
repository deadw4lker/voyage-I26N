import type {
  GridCellData, MCDMWeights, IcebergData, MonteCarloResponse,
  RouteResponse, RouteComparisonResponse, SystemStatus
} from '../types/sih';
import { buildDemoGrid, demoCompare, demoRoute, demoTrajectories, DEMO_ICEBERGS } from './demoEngine';

// Relative base so Vite proxy (`/api -> :8000`, `/api/ice -> :3001`) and the
// single-port production proxy both work. Override with VITE_API_URL if needed.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

let demoFallback = false;
export function isDemoFallback() {
  return demoFallback;
}

async function req<T>(path: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const DEFAULT_WEIGHTS: MCDMWeights = {
  iceberg_risk: 0.35, sea_ice_risk: 0.25, ocean_current_risk: 0.10,
  weather_wind_risk: 0.10, wave_risk: 0.10, bathymetry_risk: 0.10,
};

let cachedGrid: GridCellData[][] | null = null;

function demoStatus(): SystemStatus {
  return {
    status: 'DEMO_SIMULATION',
    data_harmonized: true,
    grid_cells_count: 875,
    resolution_km: 9.0,
    data_sources: {
      sea_ice: 'Synthetic (Copernicus Marine OSI-SAF schema)',
      ocean_currents: 'Synthetic (Copernicus Physics schema)',
      weather_wind: 'Synthetic (ERA5 schema)',
      waves: 'Synthetic (Copernicus Waves schema)',
      historical_icebergs: 'Synthetic (NIC catalog schema)',
      bathymetry: 'Synthetic (IBCSO v2 schema)',
    },
    pipeline_stages: [
      { stage: 'Data Ingestion', status: 'ACTIVE', latency_ms: 12, records: 6 },
      { stage: 'Data Harmonization', status: 'ACTIVE', latency_ms: 18, records: 875 },
      { stage: 'Feature Engineering', status: 'ACTIVE', latency_ms: 24, features: 18 },
      { stage: 'Monte Carlo Ensemble', status: 'ACTIVE', latency_ms: 140, simulations: 300 },
      { stage: 'Lagrangian Advection', status: 'ACTIVE', latency_ms: 45, dt_hours: 1.0 },
      { stage: 'MCDM Weighted Overlay', status: 'ACTIVE', latency_ms: 15, weights_count: 6 },
      { stage: 'Dynamic Risk Map', status: 'ACTIVE', latency_ms: 22, updated: 'Live' },
      { stage: 'Optimal A* Ship Route', status: 'ACTIVE', latency_ms: 35, algorithm: 'Risk-Aware A*' },
    ],
  };
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  try {
    const s = await req<SystemStatus>('/system-status', undefined, 6000);
    return s;
  } catch (err) {
    demoFallback = true;
    console.warn('[api] backend unreachable, using local demo engine', err);
    return demoStatus();
  }
}

export async function fetchGridRiskMap(): Promise<GridCellData[][]> {
  try {
    const g = await req<GridCellData[][]>('/risk-map', undefined, 15000);
    cachedGrid = g;
    return g;
  } catch (err) {
    demoFallback = true;
    console.warn('[api] risk-map fallback to demo grid', err);
    if (!cachedGrid) cachedGrid = buildDemoGrid(DEFAULT_WEIGHTS);
    return cachedGrid;
  }
}

export async function fetchIcebergs(): Promise<IcebergData[]> {
  try {
    return await req<IcebergData[]>('/icebergs', undefined, 6000);
  } catch (err) {
    demoFallback = true;
    console.warn('[api] icebergs fallback', err);
    return DEMO_ICEBERGS;
  }
}

export async function updateWeights(weights: MCDMWeights): Promise<GridCellData[][]> {
  try {
    const g = await req<GridCellData[][]>('/update-weights', {
      method: 'POST', body: JSON.stringify(weights),
    }, 15000);
    cachedGrid = g;
    return g;
  } catch (err) {
    demoFallback = true;
    console.warn('[api] weights fallback (local recompute)', err);
    cachedGrid = buildDemoGrid(weights);
    return cachedGrid;
  }
}

export async function predictTrajectory(
  prediction_hours = 72,
  num_simulations = 200,
): Promise<MonteCarloResponse> {
  const sims = Math.min(num_simulations, 200); // keep UI snappy
  try {
    return await req<MonteCarloResponse>('/predict-trajectory', {
      method: 'POST', body: JSON.stringify({ prediction_hours, num_simulations: sims }),
    }, 30000);
  } catch (err) {
    demoFallback = true;
    console.warn('[api] trajectory fallback', err);
    const mc = demoTrajectories(prediction_hours, Math.min(sims, 120));
    cachedGrid = buildDemoGrid(DEFAULT_WEIGHTS, mc.probability_grid);
    return mc;
  }
}

export async function calculateRoute(
  start: [number, number],
  destination: [number, number],
  mode: 'fastest' | 'safest' | 'balanced' = 'balanced',
  max_risk = 0.7,
  ship_speed_knots = 14.0,
): Promise<RouteResponse> {
  try {
    return await req<RouteResponse>('/calculate-route', {
      method: 'POST', body: JSON.stringify({ start, destination, mode, max_risk, ship_speed_knots }),
    }, 15000);
  } catch (err) {
    demoFallback = true;
    if (!cachedGrid) cachedGrid = buildDemoGrid(DEFAULT_WEIGHTS);
    return demoRoute(cachedGrid, start, destination, mode, max_risk, ship_speed_knots);
  }
}

export async function compareRoutes(
  start: [number, number],
  destination: [number, number],
  max_risk = 0.7,
  ship_speed_knots = 14.0,
): Promise<RouteComparisonResponse> {
  try {
    return await req<RouteComparisonResponse>('/compare-routes', {
      method: 'POST', body: JSON.stringify({ start, destination, max_risk, ship_speed_knots }),
    }, 20000);
  } catch (err) {
    demoFallback = true;
    if (!cachedGrid) cachedGrid = buildDemoGrid(DEFAULT_WEIGHTS);
    return demoCompare(cachedGrid, start, destination, max_risk);
  }
}

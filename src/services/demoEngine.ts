import type {
  GridCellData, MCDMWeights, IcebergData, MonteCarloResponse,
  RouteResponse, RouteComparisonResponse,
} from '../types/sih';

// Deterministic PRNG so the demo is reproducible without a backend.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROWS = 25;
const COLS = 35;
const MIN_LAT = -70, MAX_LAT = -64, MIN_LON = 40, MAX_LON = 80;

export const DEMO_ICEBERGS: IcebergData[] = [
  { id: 'B-42', latitude: -66.8, longitude: 45.2, size_category: 'Large Tabular', drift_speed: 0.6, drift_direction: 225, risk_rating: 88, source: 'Sentinel-1 SAR' },
  { id: 'C-19', latitude: -65.9, longitude: 52.1, size_category: 'Medium', drift_speed: 0.4, drift_direction: 210, risk_rating: 65, source: 'MODIS Terra' },
  { id: 'A-81', latitude: -67.4, longitude: 61.5, size_category: 'Growler', drift_speed: 0.5, drift_direction: 250, risk_rating: 42, source: 'CryoSat-2' },
  { id: 'D-07', latitude: -66.2, longitude: 68.4, size_category: 'Medium', drift_speed: 0.3, drift_direction: 200, risk_rating: 58, source: 'Sentinel-1 SAR' },
  { id: 'E-33', latitude: -68.1, longitude: 74.0, size_category: 'Tabular', drift_speed: 0.2, drift_direction: 270, risk_rating: 76, source: 'NIC Catalog' },
];

function riskLevel(score: number): GridCellData['risk_level'] {
  if (score >= 0.8) return 'EXTREME';
  if (score >= 0.6) return 'VERY HIGH';
  if (score >= 0.4) return 'HIGH';
  if (score >= 0.2) return 'MODERATE';
  return 'LOW';
}

function gauss(rand: () => number) {
  // Box-Muller
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function buildDemoGrid(weights: MCDMWeights, mcBoost?: number[][]): GridCellData[][] {
  const rand = mulberry32(42);
  // Pre-generate smooth noise fields
  const noise: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    noise[r] = [];
    for (let c = 0; c < COLS; c++) noise[r][c] = gauss(rand) * 0.05;
  }

  const grid: GridCellData[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: GridCellData[] = [];
    const lat = MAX_LAT - (r / (ROWS - 1)) * (MAX_LAT - MIN_LAT);
    const normLat = (MAX_LAT - lat) / (MAX_LAT - MIN_LAT); // 0 north -> 1 south
    for (let c = 0; c < COLS; c++) {
      const lon = MIN_LON + (c / (COLS - 1)) * (MAX_LON - MIN_LON);
      const ice = Math.min(0.98, Math.max(0, 0.1 + 0.75 * Math.pow(normLat, 1.3) + noise[r][c]));
      const iceType = ice > 0.7 ? 'Multi-Year Fast Ice' : ice > 0.4 ? 'Heavy Pack Ice' : ice > 0.15 ? 'First-Year Pack' : 'Open Water';
      const currentSpeed = Math.max(0.02, 0.25 * Math.cos((lat * Math.PI) / 180) + 0.15 * (1 - normLat) + gauss(rand) * 0.02);
      const windSpeed = Math.min(85, Math.max(5, Math.hypot(15 * (1 - normLat) - 10 * normLat, -20 * normLat) + gauss(rand) * 3));
      const waveH = Math.min(7.5, Math.max(0.2, (4.5 * (1 - normLat) + 0.5) * (1 - 0.85 * ice) + gauss(rand) * 0.2));
      const depth = Math.min(4200, Math.max(80, 3200 * (1 - Math.pow(normLat, 0.8)) + 200 + gauss(rand) * 50));
      const dHot = Math.hypot(lat - -67.2, lon - 55.0);
      const histD = Math.min(0.95, Math.max(0.05, 0.15 + 0.7 * Math.exp(-((dHot / 4.5) ** 2)) + gauss(rand) * 0.04));
      const histP = Math.min(1, Math.max(0, histD * 0.85 + 0.1));
      const mcProb = mcBoost?.[r]?.[c] ?? 0;

      const icebergRisk = Math.min(1, Math.max(0, 0.7 * mcProb + 0.3 * histP));
      const seaIceRisk = Math.pow(ice, 1.4);
      const curRisk = Math.min(1, currentSpeed / 1.0);
      const windRisk = Math.pow(Math.min(1, windSpeed / 70), 1.2);
      const waveRisk = Math.min(1, waveH / 5.5);
      const bathRisk = depth < 150 ? 1 : depth < 400 ? (400 - depth) / 250 : 0.05;

      const tw = weights.iceberg_risk + weights.sea_ice_risk + weights.ocean_current_risk +
        weights.weather_wind_risk + weights.wave_risk + weights.bathymetry_risk || 1;
      const score = Math.min(1, Math.max(0,
        (weights.iceberg_risk / tw) * icebergRisk +
        (weights.sea_ice_risk / tw) * seaIceRisk +
        (weights.ocean_current_risk / tw) * curRisk +
        (weights.weather_wind_risk / tw) * windRisk +
        (weights.wave_risk / tw) * waveRisk +
        (weights.bathymetry_risk / tw) * bathRisk,
      ));

      row.push({
        row: r, col: c, latitude: lat, longitude: lon,
        ice_concentration: +ice.toFixed(3),
        ice_drift_speed: +(0.1 + 0.3 * (1 - normLat)).toFixed(3),
        ice_drift_direction: +((250 + 30 * Math.sin(lon * 0.1)) % 360).toFixed(1),
        ice_type: iceType,
        current_speed: +currentSpeed.toFixed(3),
        current_direction: 90,
        wind_speed: +windSpeed.toFixed(1),
        wind_direction: 220,
        wave_height: +waveH.toFixed(2),
        wave_direction: 280,
        water_depth: +depth.toFixed(0),
        historical_iceberg_density: +histD.toFixed(3),
        historical_iceberg_probability: +histP.toFixed(3),
        risk_score: +score.toFixed(3),
        risk_level: riskLevel(score),
        iceberg_probability: +mcProb.toFixed(3),
      });
    }
    grid.push(row);
  }
  return grid;
}

function havKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dlat = (lat2 - lat1) * 111.139;
  const dlon = (lon2 - lon1) * 111.139 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(dlat, dlon);
}

function nearestCell(grid: GridCellData[][], lat: number, lon: number): [number, number] {
  let best: [number, number] = [0, 0];
  let bd = Infinity;
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[0].length; c++) {
      const d = havKm(lat, lon, grid[r][c].latitude, grid[r][c].longitude);
      if (d < bd) { bd = d; best = [r, c]; }
    }
  return best;
}

/** Lightweight A* on the demo grid — mirrors backend/router.py cost model. */
export function demoRoute(
  grid: GridCellData[][],
  start: [number, number],
  dest: [number, number],
  mode: 'fastest' | 'safest' | 'balanced' = 'balanced',
  maxRisk = 0.7,
  shipKnots = 14,
): RouteResponse {
  const rows = grid.length, cols = grid[0].length;
  const s = nearestCell(grid, start[0], start[1]);
  const t = nearestCell(grid, dest[0], dest[1]);
  const cfg = mode === 'fastest'
    ? { wr: 2, wi: 1, wb: 2, lim: Math.min(0.95, maxRisk + 0.2) }
    : mode === 'safest'
      ? { wr: 45, wi: 15, wb: 30, lim: maxRisk }
      : { wr: 12, wi: 4, wb: 8, lim: maxRisk + 0.05 };

  const key = (r: number, c: number) => r * 1000 + c;
  const open: [number, number, number][] = [[0, s[0], s[1]]];
  const came = new Map<number, number>();
  const g = new Map<number, number>([[key(...s), 0]]);
  const h = (r: number, c: number) =>
    havKm(grid[r][c].latitude, grid[r][c].longitude, grid[t[0]][t[1]].latitude, grid[t[0]][t[1]].longitude);

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  let found = false;
  let guard = 0;
  while (open.length && guard++ < 20000) {
    open.sort((a, b) => a[0] - b[0]);
    const [, r, c] = open.shift()!;
    if (r === t[0] && c === t[1]) { found = true; break; }
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const cell = grid[nr][nc];
      if (cell.risk_score > cfg.lim && (nr !== t[0] || nc !== t[1])) continue;
      const step = havKm(grid[r][c].latitude, grid[r][c].longitude, cell.latitude, cell.longitude);
      const shallow = cell.water_depth < 200 ? 2 : 0;
      const penalty = cfg.wr * Math.pow(cell.risk_score, 1.5) + cfg.wi * cell.ice_concentration ** 2 +
        cfg.wb * (cell.iceberg_probability || 0) + shallow;
      const ng = (g.get(key(r, c)) ?? Infinity) + step * (1 + penalty);
      if (ng < (g.get(key(nr, nc)) ?? Infinity)) {
        g.set(key(nr, nc), ng);
        came.set(key(nr, nc), key(r, c));
        open.push([ng + h(nr, nc), nr, nc]);
      }
    }
  }

  let cells: [number, number][] = found
    ? (() => {
        const path: [number, number][] = [t];
        let cur = key(...t);
        while (came.has(cur)) {
          cur = came.get(cur)!;
          path.push([Math.floor(cur / 1000), cur % 1000]);
        }
        return path.reverse();
      })()
    : [s, t];

  // Downsample long paths for the map
  if (cells.length > 120) cells = cells.filter((_, i) => i % Math.ceil(cells.length / 120) === 0);

  const route = cells.map(([r, c]) => [grid[r][c].latitude, grid[r][c].longitude] as [number, number]);
  let dist = 0;
  const risks: number[] = [];
  let encounters = 0;
  const details = cells.map(([r, c], i) => {
    const cell = grid[r][c];
    risks.push(cell.risk_score);
    if ((cell.iceberg_probability || 0) > 0.15) encounters++;
    if (i > 0) dist += havKm(route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]);
    return { latitude: cell.latitude, longitude: cell.longitude, risk_score: cell.risk_score, ice_concentration: cell.ice_concentration, iceberg_prob: cell.iceberg_probability || 0 };
  });
  const meanIce = cells.reduce((a, [r, c]) => a + grid[r][c].ice_concentration, 0) / cells.length;
  const effSpeed = Math.max(1, shipKnots * 1.852 * Math.max(0.4, 1 - 0.5 * meanIce));
  const maxR = Math.max(...risks, 0.1);
  return {
    mode,
    route,
    route_details: details,
    distance_km: +dist.toFixed(1),
    estimated_time_hours: +(dist / effSpeed).toFixed(1),
    risk_score: +(risks.reduce((a, b) => a + b, 0) / risks.length).toFixed(3),
    risk_level: (maxR >= 0.7 ? 'HIGH' : maxR >= 0.4 ? 'MODERATE' : 'LOW') as RouteResponse['risk_level'],
    iceberg_encounters: encounters,
    safety_margin_percent: +(((1 - maxR) * 100).toFixed(1)),
  };
}

export function demoTrajectories(hours = 72, sims = 120): MonteCarloResponse {
  const rand = mulberry32(7);
  const trajectories: Record<string, { timestamp: number; latitude: number; longitude: number }[][]> = {};
  const prob: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (const berg of DEMO_ICEBERGS) {
    const paths: { timestamp: number; latitude: number; longitude: number }[][] = [];
    const shown = Math.max(3, Math.round(30 / DEMO_ICEBERGS.length));
    for (let s = 0; s < sims; s++) {
      let lat = berg.latitude + gauss(rand) * 0.015;
      let lon = berg.longitude + gauss(rand) * 0.025;
      const wob = 0.5 + rand();
      const path = [{ timestamp: 0, latitude: lat, longitude: lon }];
      const steps = Math.round(hours / 2);
      for (let st = 1; st <= steps; st++) {
        lat += (-0.004 - rand() * 0.004) * wob + gauss(rand) * 0.004;
        lon += (0.008 + rand() * 0.008) * wob + gauss(rand) * 0.005;
        path.push({ timestamp: st * 2, latitude: +lat.toFixed(4), longitude: +lon.toFixed(4) });
        const r = Math.min(ROWS - 1, Math.max(0, Math.round(((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (ROWS - 1))));
        const c = Math.min(COLS - 1, Math.max(0, Math.round(((lon - MIN_LON) / (MAX_LON - MIN_LON)) * (COLS - 1))));
        prob[r][c] += 1 / sims / DEMO_ICEBERGS.length;
      }
      if (s % Math.max(1, Math.floor(sims / shown)) === 0) paths.push(path);
    }
    trajectories[berg.id] = paths;
  }
  return {
    prediction_hours: hours,
    num_simulations: sims,
    trajectories,
    probability_grid: prob.map((row) => row.map((v) => +Math.min(1, v * 3).toFixed(3))),
    confidence: 82.5,
    uncertainty_radius_km: 14.2,
  };
}

export function demoCompare(
  grid: GridCellData[][], start: [number, number], dest: [number, number], maxRisk: number,
): RouteComparisonResponse {
  return {
    fastest: demoRoute(grid, start, dest, 'fastest', maxRisk),
    safest: demoRoute(grid, start, dest, 'safest', maxRisk),
    balanced: demoRoute(grid, start, dest, 'balanced', maxRisk),
  };
}

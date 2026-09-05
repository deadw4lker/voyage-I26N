/**
 * Real-time sea-ice data layer.
 *
 * Data comes from the same-origin proxy (`server/ice-proxy.mjs`), which
 * forwards bounded queries to NOAA ERDDAP (OISST NRT, daily, ~1-day lag).
 * Values are 0..1 ice-area fractions; null = land / missing.
 */

export interface IceWindow {
  date: string; // latest observed date (YYYY-MM-DD)
  dates: string[];
  lats: number[];
  lons: number[];
  ice: (number | null)[][];
  /** Area-mean analysis error on the latest day (for confidence). */
  meanErr: number | null;
  stride: number;
  /** True when served from the committed snapshot because the live feed failed. */
  stale?: boolean;
}

export interface IceSource {
  id: string;
  name: string;
  detail: string;
  live: boolean;
}

export interface IceStatus {
  latest: string;
  /** Present on live responses; omitted in stored snapshots (volatile). */
  generatedAt?: string;
  /** Present on live responses; omitted in stored snapshots (volatile). */
  latencyHours?: number;
  resolution: string;
  sources: IceSource[];
  /** True when served from the committed snapshot because the live feed failed. */
  stale?: boolean;
}

export interface IceWindowParams {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  stride?: number;
  days?: number;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ice feed ${res.status}`);
  const body = await res.json();
  if (body && typeof body.error === 'string') throw new Error(body.detail || body.error);
  return body as T;
}

export function fetchIceStatus(): Promise<IceStatus> {
  return getJson<IceStatus>('/api/ice/status');
}

export function fetchIceWindow(p: IceWindowParams): Promise<IceWindow> {
  const q = new URLSearchParams({
    minLat: String(p.minLat),
    maxLat: String(p.maxLat),
    minLon: String(p.minLon),
    maxLon: String(p.maxLon),
    stride: String(p.stride ?? 4),
    days: String(p.days ?? 7),
  });
  return getJson<IceWindow>(`/api/ice/window?${q.toString()}`);
}

/** Mean of non-null cells in one daily grid (0..1). */
export function gridMean(grid: (number | null)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const v of grid) {
    if (v !== null && Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

/** Least-squares slope per day over valid points; null if <3 valid. */
function trendSlope(values: (number | null)[]): number | null {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) continue;
    n++;
    sx += i;
    sy += v;
    sxx += i * i;
    sxy += i * v;
  }
  if (n < 3) return null;
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  return (n * sxy - sx * sy) / denom;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Project one grid `leadDays` ahead of the last observed day using a
 * per-cell linear trend. Cells without enough history fall back to their
 * last observed value. Honestly labeled as projection in the UI.
 */
export function projectGrid(w: IceWindow, leadDays: number): (number | null)[] {
  const nDays = w.dates.length;
  const nCells = w.lats.length * w.lons.length;
  const out: (number | null)[] = new Array(nCells);
  for (let c = 0; c < nCells; c++) {
    const history: (number | null)[] = [];
    for (let d = 0; d < nDays; d++) history.push(w.ice[d][c]);
    const last = [...history]
      .reverse()
      .find((v): v is number => v !== null && Number.isFinite(v));
    if (last === undefined) {
      out[c] = null;
      continue;
    }
    const slope = trendSlope(history);
    out[c] = slope === null ? last : clamp01(last + slope * leadDays);
  }
  return out;
}

/** Daily area-mean series (0..100 %) for the observed window. */
export function observedMeans(w: IceWindow): (number | null)[] {
  return w.ice.map((g) => {
    const m = gridMean(g);
    return m === null ? null : Math.round(m * 1000) / 10;
  });
}

/**
 * Confidence 0..100 derived from the analysis error field (mean `err` on
 * the latest day) with decay by lead time. Rises to the present, falls
 * into the projection horizon.
 */
export function confidenceForLead(w: IceWindow, leadDays: number): number {
  const m = w.meanErr ?? 0.3;
  const base = Math.min(97, Math.max(55, 100 - m * 30));
  return Math.round(Math.min(97, Math.max(50, base - leadDays * 1.9)) * 10) / 10;
}

/** Format YYYY-MM-DD for display (UTC, locale-agnostic). */
export function formatIceDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

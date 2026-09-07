import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { DataLayersState, GridCellData } from '../../types/sih';

interface FlowFieldProps {
  riskGrid: GridCellData[][];
  layers: DataLayersState;
}

interface VectorField {
  lats: number[];
  lons: number[];
  u: Float32Array; // east component, m/s
  v: Float32Array; // north component, m/s
  rows: number;
  cols: number;
  maxSpeed: number;
}

interface Particle {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
  kind: 'wind' | 'current';
}

const WIND_COLOR = '210, 220, 230';
const CURRENT_COLOR = '94, 234, 212';

/** Resample a speed+direction grid column into a u/v vector field. */
function buildField(
  grid: GridCellData[][],
  pick: (c: GridCellData) => [number, number], // [speed m/s, direction deg]
): VectorField | null {
  if (grid.length === 0 || grid[0].length === 0) return null;
  const rows = grid.length;
  const cols = grid[0].length;
  const lats = grid.map((row) => row[0].latitude);
  const lons = grid[0].map((c) => c.longitude);
  const u = new Float32Array(rows * cols);
  const v = new Float32Array(rows * cols);
  let maxSpeed = 0.01;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [speed, dir] = pick(grid[r][c]);
      const rad = (dir * Math.PI) / 180;
      u[r * cols + c] = speed * Math.sin(rad);
      v[r * cols + c] = speed * Math.cos(rad);
      if (speed > maxSpeed) maxSpeed = speed;
    }
  }
  return { lats, lons, u, v, rows, cols, maxSpeed };
}

function findIdx(vals: number[], x: number): [number, number, number] {
  // Returns [i0, i1, t] for linear interpolation. Handles descending axes.
  const n = vals.length;
  if (n === 1) return [0, 0, 0];
  const asc = vals[n - 1] >= vals[0];
  const lo = asc ? vals[0] : vals[n - 1];
  const hi = asc ? vals[n - 1] : vals[0];
  const xc = Math.min(hi, Math.max(lo, x));
  let i0 = 0;
  for (let i = 0; i < n - 1; i++) {
    const a = vals[i];
    const b = vals[i + 1];
    if ((asc && xc >= a && xc <= b) || (!asc && xc <= a && xc >= b)) {
      i0 = i;
      break;
    }
    i0 = i;
  }
  const i1 = Math.min(n - 1, i0 + 1);
  const span = vals[i1] - vals[i0];
  const t = span === 0 ? 0 : (xc - vals[i0]) / span;
  return [i0, i1, t];
}

/** Bilinear sample of the vector field. Returns [u, v, speed]. */
function sample(f: VectorField, lat: number, lon: number): [number, number, number] {
  const [r0, r1, tr] = findIdx(f.lats, lat);
  const [c0, c1, tc] = findIdx(f.lons, lon);
  const at = (r: number, c: number) => f.u[r * f.cols + c];
  const atV = (r: number, c: number) => f.v[r * f.cols + c];
  const u = at(r0, c0) * (1 - tr) * (1 - tc) + at(r1, c0) * tr * (1 - tc) + at(r0, c1) * (1 - tr) * tc + at(r1, c1) * tr * tc;
  const v = atV(r0, c0) * (1 - tr) * (1 - tc) + atV(r1, c0) * tr * (1 - tc) + atV(r0, c1) * (1 - tr) * tc + atV(r1, c1) * tr * tc;
  return [u, v, Math.hypot(u, v)];
}

/**
 * Canvas flow-particle overlay (Windy-style). Advects particles through the
 * grid's wind and current vector fields and leaves fading trails.
 * Wired to the Wind / Ocean currents layer toggles.
 */
export function FlowField({ riskGrid, layers }: FlowFieldProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef({ riskGrid, layers });
  liveRef.current = { riskGrid, layers };

  // Mount a transparent canvas in the overlay pane.
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    map.getPanes().overlayPane.appendChild(canvas);
    canvasRef.current = canvas;

    const place = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    };
    const clear = () => {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    };
    place();
    map.on('move zoom viewreset resize', place);
    map.on('movestart zoomstart', clear);
    return () => {
      map.off('move zoom viewreset resize', place);
      map.off('movestart zoomstart', clear);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map]);

  const wind = useMemo(
    () => buildField(riskGrid, (c) => [c.wind_speed / 3.6, c.wind_direction]),
    [riskGrid],
  );
  const current = useMemo(
    () => buildField(riskGrid, (c) => [c.current_speed, c.current_direction]),
    [riskGrid],
  );
  const fieldsRef = useRef({ wind, current });
  fieldsRef.current = { wind, current };

  // Animation loop.
  useEffect(() => {
    let raf = 0;
    let particles: Particle[] = [];
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const spawn = (kind: 'wind' | 'current'): Particle => {
      const b = map.getBounds();
      return {
        lat: b.getSouth() + Math.random() * (b.getNorth() - b.getSouth()),
        lon: b.getWest() + Math.random() * (b.getEast() - b.getWest()),
        age: 0,
        maxAge: 50 + Math.random() * 70,
        kind,
      };
    };

    const drawStatic = () => {
      // Reduced-motion fallback: one frame of short streaks, no animation.
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const { wind: w, current: c } = fieldsRef.current;
      const { layers: ly } = liveRef.current;
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const jobs: { f: VectorField; color: string }[] = [];
      if (ly.wind && w) jobs.push({ f: w, color: WIND_COLOR });
      if (ly.oceanCurrents && c) jobs.push({ f: c, color: CURRENT_COLOR });
      if (jobs.length === 0) return;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 350; i++) {
        const job = jobs[i % jobs.length];
        const p = spawn(i % 2 === 0 ? 'wind' : 'current');
        const [u, v] = sample(job.f, p.lat, p.lon);
        const m = Math.hypot(u, v) || 1;
        const from = map.latLngToContainerPoint([p.lat, p.lon]);
        const to = map.latLngToContainerPoint([
          p.lat + (v / m) * 0.12,
          p.lon + (u / m) * 0.12,
        ]);
        ctx.strokeStyle = `rgba(${job.color},0.55)`;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    };

    if (reduced) {
      drawStatic();
      map.on('moveend zoomend', drawStatic);
      return () => {
        map.off('moveend zoomend', drawStatic);
      };
    }

    const frame = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const { wind: w, current: c } = fieldsRef.current;
      const { layers: ly, riskGrid: grid } = liveRef.current;
      const wantWind = ly.wind && w && grid.length > 0;
      const wantCurrent = ly.oceanCurrents && c && grid.length > 0;

      if (!canvas || !ctx || (!wantWind && !wantCurrent)) {
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = [];
        raf = requestAnimationFrame(frame);
        return;
      }

      const size = map.getSize();
      if (canvas.width !== size.x || canvas.height !== size.y) {
        canvas.width = size.x;
        canvas.height = size.y;
      }

      // Fade previous trails toward transparent.
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = 'rgba(0,0,0,0.88)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      const target = Math.min(850, Math.floor((size.x * size.y) / 1100));
      const kinds: ('wind' | 'current')[] = [
        ...(wantWind ? ['wind' as const] : []),
        ...(wantCurrent ? ['current' as const] : []),
      ];
      while (particles.length < target) {
        particles.push(spawn(kinds[particles.length % kinds.length]));
      }
      if (particles.length > target) particles.length = target;

      const bounds = map.getBounds();
      for (const p of particles) {
        const field = p.kind === 'wind' ? w! : c!;
        const [u, v, speed] = sample(field, p.lat, p.lon);
        const mag = Math.hypot(u, v);
        p.age++;
        const out =
          p.age > p.maxAge ||
          p.lat < bounds.getSouth() || p.lat > bounds.getNorth() ||
          p.lon < bounds.getWest() || p.lon > bounds.getEast() ||
          mag < 1e-6;
        if (out) {
          Object.assign(p, spawn(p.kind));
          continue;
        }
        const from = map.latLngToContainerPoint([p.lat, p.lon]);
        // Fixed screen step along the flow direction, length hints at speed.
        const step = 0.9 + 1.7 * Math.min(1, speed / field.maxSpeed);
        const to = L.point(from.x + (u / mag) * step, from.y + (v / mag) * step * -1);
        // Note: screen y grows downward while north is up — flip handled via projection:
        const dest = map.containerPointToLatLng([from.x + (u / mag) * step, from.y - (v / mag) * step]);
        p.lat = dest.lat;
        p.lon = dest.lng;
        const color = p.kind === 'wind' ? WIND_COLOR : CURRENT_COLOR;
        const norm = Math.min(1, speed / field.maxSpeed);
        // Drift (current) particles render a touch brighter and thicker.
        const base = p.kind === 'current' ? 0.35 : 0.25;
        const gain = p.kind === 'current' ? 0.6 : 0.55;
        ctx.lineWidth = p.kind === 'current' ? 1.4 : 1.2;
        ctx.strokeStyle = `rgba(${color},${(base + gain * norm).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [map, wind, current]);

  return null;
}

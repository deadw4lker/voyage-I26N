/**
 * Hima-Drishti ice data proxy.
 *
 * The browser cannot call NOAA ERDDAP directly (no CORS headers), so this
 * same-origin server forwards small, bounded subset queries and caches them
 * (ERDDAP throttles aggressively — HTTP 429).
 *
 *   GET /api/ice/status
 *     -> { latest, latencyHours, resolution, source }
 *   GET /api/ice/window?minLat=&maxLat=&minLon=&maxLon=&stride=&days=
 *     -> { date, dates[], lats[], lons[], ice[][] (row-major per day), err[][] }
 *        ice values are 0..1 fractions, null = land / missing.
 *   GET /api/ice/series?lat=&lon=&days=
 *     -> { points: [{ date, ice, err }] } at the nearest grid cell.
 *
 * In production (`npm run serve`) it also serves ../dist statically.
 */

import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Prefer IPv4: some networks blackhole IPv6 and undici hangs instead of
// falling back (curl is unaffected). This only affects lookup ordering.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // older runtimes — default ordering applies
}

const PORT = Number(process.env.PORT || 3001);
const SIH_BACKEND = process.env.SIH_BACKEND || 'http://127.0.0.1:8000';
const UPSTREAM_GRIDDAP = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg';
const UA = 'Hima-Drishti/0.0 (+polar-ops-demo)';
const MAX_CELLS = 14400;
const TTL_STATUS = 60 * 60 * 1000;
const TTL_DATA = 6 * 60 * 60 * 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

// Committed last-known-good snapshots (server/snapshot/). Served with
// `stale: true` when NOAA ERDDAP is unreachable (e.g. stalls from some
// datacenter networks), so the UI shows real dated data instead of failing.
// PINNED_* must match ForecastView's useIceWindow params exactly.
const SNAP_DIR = path.resolve(__dirname, 'snapshot');
const PINNED_WINDOW_PARAMS = { minLat: -75, maxLat: -55, minLon: 25, maxLon: 85, stride: 2, days: 7 };
let PINNED_WINDOW_QUERY = '?minLat=-75&maxLat=-55&minLon=25&maxLon=85&stride=2&days=7';
try {
  PINNED_WINDOW_QUERY = fs.readFileSync(path.join(SNAP_DIR, 'window.query.txt'), 'utf8').trim() || PINNED_WINDOW_QUERY;
} catch {
  // seed file absent — fall back to built-in pinned query
}

function readSnapshot(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SNAP_DIR, `${name}.json`), 'utf8'));
  } catch {
    return null;
  }
}

// Best-effort persistence of fresh fetches: keeps the on-disk snapshot warm
// across restarts (Render filesystem is ephemeral, repo seed is the backup).
function persistSnapshot(name, body) {
  try {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    fs.writeFileSync(path.join(SNAP_DIR, `${name}.json`), body);
  } catch {
    // snapshots are optional — never fail a live response over them
  }
}

// Serves the snapshot with `stale: true`. Returns false when no snapshot exists.
function staleResponse(res, name) {
  const snap = readSnapshot(name);
  if (!snap) return false;
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' }).end(
    JSON.stringify({ ...snap, stale: true }),
  );
  return true;
}

// Fast failover: remember recent upstream outages (memory + disk, so it
// survives restarts/sleeps) and skip doomed upstream attempts during a
// cooldown. Any HTTP response proves the path works and clears the flag;
// the cooldown expiry allows a fresh probe so recovery is automatic.
const UPSTREAM_STATE_FILE = path.join(SNAP_DIR, 'upstream.state.json');
const UPSTREAM_COOLDOWN_MS = 10 * 60 * 1000;
let upstreamDownSince = 0;
try {
  const st = JSON.parse(fs.readFileSync(UPSTREAM_STATE_FILE, 'utf8'));
  if (st && typeof st.downSince === 'number') upstreamDownSince = st.downSince;
} catch {
  // no recorded outage — probe normally
}

function noteUpstreamUp() {
  if (!upstreamDownSince) return;
  upstreamDownSince = 0;
  console.error('[ice-proxy] upstream reachable again, outage flag cleared');
  try {
    fs.rmSync(UPSTREAM_STATE_FILE, { force: true });
  } catch {}
}

function noteUpstreamDown() {
  const first = !upstreamDownSince;
  if (first) {
    upstreamDownSince = Date.now();
    console.error('[ice-proxy] upstream unreachable, fast-failover armed for 10 min');
  }
  try {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    fs.writeFileSync(UPSTREAM_STATE_FILE, JSON.stringify({ downSince: upstreamDownSince }));
  } catch {}
}

function upstreamKnownDown() {
  if (!upstreamDownSince) return false;
  if (Date.now() - upstreamDownSince > UPSTREAM_COOLDOWN_MS) {
    upstreamDownSince = 0; // cooldown expired — allow a fresh probe
    return false;
  }
  return true;
}

const cache = new Map(); // key -> { exp: number, body: string }

function getCached(key) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.body;
  cache.delete(key);
  return null;
}

function setCached(key, body, ttl) {
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { exp: Date.now() + ttl, body });
}

function rawGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(
      url,
      { family: 4, timeout: timeoutMs, headers: { 'User-Agent': UA } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('timeout', () => req.destroy(new Error('upstream timeout')));
    req.on('error', reject);
  });
}

async function upstream(url, timeoutMs = 25000) {
  if (upstreamKnownDown()) throw new Error('NOAA ERDDAP recently unreachable, skipping probe');
  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    let r;
    try {
      r = await rawGet(current, timeoutMs);
    } catch (e) {
      noteUpstreamDown();
      throw e;
    }
    noteUpstreamUp(); // any HTTP response (even 429/5xx) proves the network path works
    const { status, headers, body } = r;
    if (status >= 300 && status < 400 && headers.location) {
      current = new URL(headers.location, current).toString();
      continue;
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      body,
      json: () => JSON.parse(body),
    };
  }
  throw new Error('too many redirects');
}

async function upstreamOk(url, timeoutMs = 25000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await upstream(url, timeoutMs); // raw single attempt (may redirect)
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 2500));
      continue;
    }
    throw new Error(`NOAA ERDDAP ${res.status}: ${res.body.slice(0, 160)}`);
  }
  throw new Error('NOAA ERDDAP unreachable after retry');
}

async function getLatestDate() {
  const key = 'status:latest';
  const hit = getCached(key, TTL_STATUS);
  if (hit) return hit;
  const res = await upstreamOk(
    'https://coastwatch.pfeg.noaa.gov/erddap/info/ncdcOisst21NrtAgg/index.json',
    12000, // fail fast to the committed snapshot when the network stalls
  );
  const info = await res.json();
  const row = info.table.rows.find(
    (r) => r[0] === 'attribute' && r[1] === 'NC_GLOBAL' && r[2] === 'time_coverage_end',
  );
  if (!row) throw new Error('latest date not found in dataset metadata');
  const latest = row[4].slice(0, 10); // YYYY-MM-DD
  setCached(key, latest, TTL_STATUS);
  return latest;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snapLat = (v) => 0.125 + 0.25 * Math.round((clamp(v, -89.875, 89.875) - 0.125) / 0.25);
const to360 = (v) => ((v % 360) + 360) % 360;
const snapLon = (v) => {
  const w = to360(v);
  const s = 0.125 + 0.25 * Math.round((w - 0.125) / 0.25);
  return s >= 360 ? s - 360 : s;
};

function parseParams(url) {
  const u = new URL(url, 'http://x');
  const num = (k, d) => {
    const v = Number(u.searchParams.get(k));
    return Number.isFinite(v) ? v : d;
  };
  return {
    minLat: num('minLat', -75),
    maxLat: num('maxLat', -55),
    minLon: num('minLon', 25),
    maxLon: num('maxLon', 85),
    stride: Math.max(1, Math.floor(num('stride', 4))),
    days: clamp(Math.floor(num('days', 7)), 1, 14),
    lat: num('lat', -67.14),
    lon: num('lon', 45.82),
  };
}

function datePlus(iso, deltaDays) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function erddapUrl(vars, timeExpr, latExpr, lonExpr) {
  // Each variable carries its own constraint expression.
  const perVar = vars.map((v) => `${v}${timeExpr}[(0.0):1:(0.0)]${latExpr}${lonExpr}`).join(',');
  // Brackets must stay literal for ERDDAP; encodeURI leaves [ ] ( ) intact.
  return encodeURI(`${UPSTREAM_GRIDDAP}.json?${perVar}`);
}

async function handleWindow(q) {
  let { minLat, maxLat, minLon, maxLon, stride, days } = q;
  if (minLat > maxLat) [minLat, maxLat] = [maxLat, minLat];
  if (minLon > maxLon) [minLon, maxLon] = [maxLon, minLon];
  minLat = clamp(minLat, -89.875, 89.875);
  maxLat = clamp(maxLat, -89.875, 89.875);

  let sLat = snapLat(minLat);
  let eLat = snapLat(maxLat);
  let sLon = snapLon(minLon);
  let eLon = snapLon(maxLon);

  // Enforce cell budget by widening stride (assume ≤180° lon span).
  let nLat = Math.floor((eLat - sLat) / (0.25 * stride)) + 1;
  let nLon = Math.floor(((eLon >= sLon ? eLon - sLon : eLon + 360 - sLon)) / (0.25 * stride)) + 1;
  while (nLat * nLon > MAX_CELLS && stride < 64) {
    stride *= 2;
    nLat = Math.floor((eLat - sLat) / (0.25 * stride)) + 1;
    nLon =
      Math.floor((eLon >= sLon ? eLon - sLon : eLon + 360 - sLon) / (0.25 * stride)) + 1;
  }

  const latest = await getLatestDate();
  const start = datePlus(latest, -(days - 1));
  const key = `w:${sLat}:${eLat}:${sLon}:${eLon}:${stride}:${start}:${latest}`;
  const hit = getCached(key, TTL_DATA);
  if (hit) return hit;

  const url = erddapUrl(
    ['ice', 'err'],
    `[(${start}):1:(${latest})]`,
    `[(${sLat.toFixed(3)}):${stride}:(${eLat.toFixed(3)})]`,
    `[(${sLon.toFixed(3)}):${stride}:(${eLon.toFixed(3)})]`,
  );
  const res = await upstreamOk(url, 45000);
  const table = (await res.json()).table;
  const rows = table.rows;

  const dates = [];
  const lats = [];
  const lons = [];
  const grids = {}; // date -> lat -> lon -> { ice, err }
  for (const [t, , la, lo, ice, err] of rows) {
    const day = String(t).slice(0, 10);
    if (!grids[day]) {
      grids[day] = {};
      dates.push(day);
    }
    if (!grids[day][la]) grids[day][la] = {};
    grids[day][la][lo] = [
      ice === null ? null : Math.round(ice * 100) / 100,
      err === null ? null : Math.round(err * 100) / 100,
    ];
    if (!lats.includes(la)) lats.push(la);
    if (!lons.includes(lo)) lons.push(lo);
  }
  dates.sort();
  lats.sort((a, b) => a - b);
  lons.sort((a, b) => a - b);

  const ice = [];
  const errSums = { sum: 0, n: 0 };
  for (const day of dates) {
    const gi = [];
    for (const la of lats) {
      for (const lo of lons) {
        const cell = grids[day][la]?.[lo];
        gi.push(cell ? cell[0] : null);
        if (day === dates[dates.length - 1] && cell && cell[1] !== null) {
          errSums.sum += cell[1];
          errSums.n++;
        }
      }
    }
    ice.push(gi);
  }
  const meanErr = errSums.n === 0 ? null : Math.round((errSums.sum / errSums.n) * 100) / 100;

  const body = JSON.stringify({ date: latest, dates, lats, lons, ice, stride, meanErr });
  setCached(key, body, TTL_DATA);
  const p = PINNED_WINDOW_PARAMS;
  if (
    minLat === p.minLat && maxLat === p.maxLat && minLon === p.minLon &&
    maxLon === p.maxLon && stride === p.stride && days === p.days
  ) {
    persistSnapshot('window', body);
  }
  return body;
}

async function handleSeries(q) {
  const la = snapLat(q.lat);
  const lo = snapLon(q.lon);
  const latest = await getLatestDate();
  const start = datePlus(latest, -(q.days - 1));
  const key = `s:${la}:${lo}:${start}:${latest}`;
  const hit = getCached(key, TTL_DATA);
  if (hit) return hit;

  const url = erddapUrl(
    ['ice', 'err'],
    `[(${start}):1:(${latest})]`,
    `[(${la.toFixed(3)}):1:(${la.toFixed(3)})]`,
    `[(${lo.toFixed(3)}):1:(${lo.toFixed(3)})]`,
  );
  const res = await upstreamOk(url, 30000);
  const rows = (await res.json()).table.rows;
  const points = rows.map(([t, , , , ice, err]) => ({
    date: String(t).slice(0, 10),
    ice: ice === null ? null : Math.round(ice * 100) / 100,
    err: err === null ? null : Math.round(err * 100) / 100,
  }));
  const body = JSON.stringify({ date: latest, lat: la, lon: lo, points });
  setCached(key, body, TTL_DATA);
  return body;
}

async function handleStatus() {
  const latest = await getLatestDate();
  const latencyHours = Math.round((Date.now() - new Date(`${latest}T12:00:00Z`).getTime()) / 3600000);
  return JSON.stringify({
    latest,
    generatedAt: new Date().toISOString(),
    latencyHours,
    resolution: '0.25°',
    sources: [
      { id: 'oisst', name: 'OISST Blend (NOAA NCEI)', detail: 'Daily, 0.25° global', live: true },
      { id: 'nsidc', name: 'NSIDC NRT (passive microwave)', detail: 'Connecting soon', live: false },
      { id: 'viirs', name: 'VIIRS NRT (high-res optical)', detail: 'Connecting soon', live: false },
    ],
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(reqUrl, res) {
  const pathname = new URL(reqUrl, 'http://x').pathname;
  let file = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname.slice(1));
  if (!file.startsWith(DIST_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, fallback) => {
        if (err2) {
          res.writeHead(404, { 'content-type': 'text/plain' }).end('dist not built — run npm run build');
          return;
        }
        res.writeHead(200, { 'content-type': MIME['.html'] }).end(fallback);
      });
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const fail = (e) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    res.writeHead(502, { 'content-type': 'application/json' }).end(
      JSON.stringify({ error: 'live feed unavailable', detail: String(e?.message || e).slice(0, 200) }),
    );
  };
  try {
    const pathname = new URL(req.url || '/', 'http://x').pathname;
    if (req.method === 'GET' && pathname === '/api/ice/status') {
      try {
        const body = await handleStatus();
        try {
          // Persist without volatile server-computed fields, so the snapshot
          // only changes when NOAA data changes (keeps the file committable).
          const s = JSON.parse(body);
          delete s.generatedAt;
          delete s.latencyHours;
          persistSnapshot('status', JSON.stringify(s));
        } catch {}
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' }).end(body);
      } catch (e) {
        if (!staleResponse(res, 'status')) fail(e);
      }
    } else if (req.method === 'GET' && pathname === '/api/ice/window') {
      try {
        const body = await handleWindow(parseParams(req.url));
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=21600' }).end(body);
      } catch (e) {
        const rawQuery = new URL(req.url || '/', 'http://x').search;
        if (!(rawQuery === PINNED_WINDOW_QUERY && staleResponse(res, 'window'))) fail(e);
      }
    } else if (req.method === 'GET' && pathname === '/api/ice/series') {
      try {
        const body = await handleSeries(parseParams(req.url));
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=21600' }).end(body);
      } catch (e) { fail(e); }
    } else if (pathname.startsWith('/api/') && !pathname.startsWith('/api/ice/')) {
      // SIH simulation backend (FastAPI :8000). Pass-through so the built
      // frontend works on a single port in production (`npm run serve`).
      // When the backend is down, the frontend falls back to its local demo
      // engine, so never fail hard here.
      try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks);
        const target = new URL(req.url, SIH_BACKEND);
        const proxy = (target.protocol === 'https:' ? https : http).request(
          target,
          { method: req.method, headers: { ...req.headers, host: target.host } },
          (up) => {
            res.writeHead(up.statusCode || 502, { ...up.headers, 'access-control-allow-origin': '*' });
            up.pipe(res);
          },
        );
        proxy.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(503, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end(
              JSON.stringify({ error: 'simulation backend unavailable', demo: true }),
            );
          }
        });
        proxy.end(body);
      } catch (e) { fail(e); }
    } else if (pathname.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'unknown endpoint' }));
    } else if (req.method === 'GET') {
      serveStatic(req.url, res);
    } else {
      res.writeHead(405).end('method not allowed');
    }
  } catch (e) {
    fail(e);
  }
});

server.listen(PORT, () => {
  console.log(`Hima-Drishti ice proxy on http://localhost:${PORT} (serving ${DIST_DIR})`);
});

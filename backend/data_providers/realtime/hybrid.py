"""
Hybrid Antarctic data provider: live public feeds fused onto the ops grid.

Live layers (no API keys required):
  sea ice      NOAA OISST v2.1 NRT via CoastWatch ERDDAP (daily, 0.25 deg)
  bathymetry   ETOPO relief via CoastWatch ERDDAP (static terrain)
  wind         Open-Meteo NWP (GFS/ICON), 10 m analysis
  waves        Open-Meteo marine model (CMEMS-forced)
  currents     Open-Meteo marine model (CMEMS Global Ocean)
  ice drift    derived live: 0.8 * current + 0.02 * wind
  berg drift   sampled from the live current+wind field at each berg

Static / synthetic (no reliable keyless public feed exists):
  berg seed positions   synthetic tracked set (documented demo positions)
  historical density    synthetic climatology hotspots

Every live layer degrades gracefully: per-cell fallback to the synthetic base
when a source is down or a cell is missing (land/null), with health reported
per layer so the UI can badge LIVE vs SYNTHETIC honestly.
"""

import os
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List

from backend.data_providers.synthetic_provider import SyntheticAntarcticDataProvider
from backend.data_providers.realtime import oisst, etopo, openmeteo

USE_LIVE = os.environ.get('USE_LIVE_DATA', '1') == '1'


def _as_ascending(vals):
    a = np.array(vals, dtype=float)
    if len(a) > 1 and a[-1] < a[0]:
        return a[::-1], True
    return a, False


def resample(src_lats, src_lons, src_vals, dst_lat, dst_lon):
    """
    Bilinear resample of a regular source grid onto destination points.
    NaN source cells propagate as NaN so callers can fall back per cell.
    dst_lat/dst_lon are 2D arrays; returns 2D array of the same shape.
    """
    sl, flip_r = _as_ascending(src_lats)
    sn, flip_c = _as_ascending(src_lons)
    sv = np.array(src_vals, dtype=float)
    if flip_r:
        sv = sv[::-1, :]
    if flip_c:
        sv = sv[:, ::-1]

    r = np.clip(np.searchsorted(sl, dst_lat) - 1, 0, len(sl) - 2)
    c = np.clip(np.searchsorted(sn, dst_lon) - 1, 0, len(sn) - 2)
    r1 = np.minimum(r + 1, len(sl) - 1)
    c1 = np.minimum(c + 1, len(sn) - 1)

    lat0, lat1 = sl[r], sl[r1]
    lon0, lon1 = sn[c], sn[c1]
    tr = np.where(lat1 > lat0, (dst_lat - lat0) / np.maximum(lat1 - lat0, 1e-9), 0.0)
    tc = np.where(lon1 > lon0, (dst_lon - lon0) / np.maximum(lon1 - lon0, 1e-9), 0.0)

    v00, v10 = sv[r, c], sv[r1, c]
    v01, v11 = sv[r, c1], sv[r1, c1]
    return v00 * (1 - tr) * (1 - tc) + v10 * tr * (1 - tc) + v01 * (1 - tr) * tc + v11 * tr * tc


def _dir_to_uv(speed, direction_deg):
    rad = np.radians(direction_deg)
    return speed * np.sin(rad), speed * np.cos(rad)


def _uv_to_dir(u, v):
    return (np.degrees(np.arctan2(u, v)) + 360.0) % 360.0


def resample_masked(src_lats, src_lons, vals, dst_lat, dst_lon, min_weight: float = 0.25):
    """
    Bilinear resample that tolerates missing source cells (NaN): valid cells
    are weight-averaged, and areas without coverage come back NaN so the
    caller can fall back to synthetic values per cell.
    """
    vals = np.array(vals, dtype=float)
    valid = (~np.isnan(vals)).astype(float)
    filled = np.where(np.isnan(vals), 0.0, vals)
    w = resample(src_lats, src_lons, valid, dst_lat, dst_lon)
    v = resample(src_lats, src_lons, filled, dst_lat, dst_lon)
    ok = w > min_weight
    return np.where(ok, v / np.maximum(w, 1e-6), np.nan), ok


class HybridAntarcticDataProvider(SyntheticAntarcticDataProvider):
    def __init__(self, rows: int = 25, cols: int = 35, seed: int = 42, live: bool = True):
        super().__init__(rows=rows, cols=cols, seed=seed)
        self.health: Dict[str, Dict[str, Any]] = {}
        if live and USE_LIVE:
            self._ingest_live()

    # -- live ingestion -------------------------------------------------
    def _ingest_live(self):
        bounds = (self.min_lat, self.max_lat, self.min_lon, self.max_lon)
        with ThreadPoolExecutor(max_workers=3) as pool:
            f_ice = pool.submit(self._ingest_ice, *bounds)
            f_terrain = pool.submit(self._ingest_terrain, *bounds)
            f_met = pool.submit(self._ingest_metocean, *bounds)
            for f in (f_ice, f_terrain, f_met):
                try:
                    f.result()
                except Exception as e:
                    print(f'[hybrid] layer ingest failed: {e}')

    def _ingest_ice(self, min_lat, max_lat, min_lon, max_lon):
        try:
            data = oisst.fetch_oisst_ice(min_lat, max_lat, min_lon, max_lon)
            raw = np.array(data['ice'], dtype=float)  # NaN where land/missing
            live = resample(data['lats'], data['lons'], raw, self.lat_grid, self.lon_grid)
            valid = ~np.isnan(live)
            if valid.sum() == 0:
                raise RuntimeError('OISST returned no valid cells')
            self.ice_concentration = np.where(valid, np.clip(live, 0.0, 0.98), self.ice_concentration)
            self.ice_type = np.where(self.ice_concentration > 0.7, 'Multi-Year Fast Ice',
                            np.where(self.ice_concentration > 0.4, 'Heavy Pack Ice',
                            np.where(self.ice_concentration > 0.15, 'First-Year Pack', 'Open Water')))
            self.health['sea_ice'] = {'live': True, 'source': 'NOAA OISST v2.1 NRT',
                                      'updated': data.get('date'), 'note': f"{int(valid.sum())}/{valid.size} live cells"}
        except Exception as e:
            print(f'[hybrid] sea-ice live failed, synthetic kept: {e}')
            self.health['sea_ice'] = {'live': False, 'source': 'Synthetic (OISST schema)', 'updated': None}

    def _ingest_terrain(self, min_lat, max_lat, min_lon, max_lon):
        try:
            data = etopo.fetch_etopo_depth(min_lat, max_lat, min_lon, max_lon)
            raw = np.array(data['depth_m'], dtype=float)
            live = resample(data['lats'], data['lons'], raw, self.lat_grid, self.lon_grid)
            self.water_depth = np.clip(np.where(np.isnan(live), self.water_depth, live), 20.0, 11000.0)
            self.health['bathymetry'] = {'live': True, 'source': 'ETOPO relief (ERDDAP)',
                                         'updated': data.get('fetched_at', '')[:10] or None}
        except Exception as e:
            print(f'[hybrid] bathymetry live failed, synthetic kept: {e}')
            self.health['bathymetry'] = {'live': False, 'source': 'Synthetic (IBCSO schema)', 'updated': None}

    def _ingest_metocean(self, min_lat, max_lat, min_lon, max_lon):
        try:
            data = openmeteo.fetch_openmeteo(min_lat, max_lat, min_lon, max_lon)
            fetched = (data.get('fetched_at', '')[:10] or None)

            slats, slons = data['lats'], data['lons']

            def comp(key):
                return np.array(data[key], dtype=float)

            def vec(spd_key, dir_key):
                spd, drc = comp(spd_key), comp(dir_key)
                return spd * np.sin(np.radians(drc)), spd * np.cos(np.radians(drc))

            wu_s, wv_s = vec('wind_ms', 'wind_dir')
            cu_s, cv_s = vec('current_ms', 'current_dir')
            wdu_s = np.cos(np.radians(comp('wave_dir')))
            wdv_s = np.sin(np.radians(comp('wave_dir')))

            def R(a):
                return resample_masked(slats, slons, a, self.lat_grid, self.lon_grid)

            wu, ok_wu = R(wu_s)
            wv, ok_wv = R(wv_s)
            cu, ok_cu = R(cu_s)
            cv, ok_cv = R(cv_s)
            wv_h, ok_wv_h = R(comp('wave_m'))
            wdu, ok_du = R(wdu_s)
            wdv, ok_dv = R(wdv_s)

            ok_w = ok_wu & ok_wv
            ok_c = ok_cu & ok_cv
            ok_wd = ok_du & ok_dv & ok_wv_h

            if ok_w.any():
                self.u_wind = np.where(ok_w, wu, self.u_wind)
                self.v_wind = np.where(ok_w, wv, self.v_wind)
                self.wind_speed = np.where(ok_w, np.clip(np.hypot(self.u_wind, self.v_wind) * 3.6, 5.0, 120.0), self.wind_speed)
                self.wind_direction = np.where(ok_w, _uv_to_dir(self.u_wind, self.v_wind), self.wind_direction)
            if ok_c.any():
                self.u_current = np.where(ok_c, cu, self.u_current)
                self.v_current = np.where(ok_c, cv, self.v_current)
                self.current_speed = np.where(ok_c, np.hypot(self.u_current, self.v_current), self.current_speed)
                self.current_direction = np.where(ok_c, _uv_to_dir(self.u_current, self.v_current), self.current_direction)
            if ok_wv_h.any():
                self.wave_height = np.where(ok_wv_h, np.clip(wv_h, 0.1, 12.0), self.wave_height)
                self.wave_direction = np.where(ok_wd, (np.degrees(np.arctan2(wdv, wdu)) + 360.0) % 360.0, self.wave_direction)

            # Ice drift derived live from real forcing.
            u_ice = 0.8 * self.u_current + 0.02 * self.u_wind
            v_ice = 0.8 * self.v_current + 0.02 * self.v_wind
            self.ice_drift_speed = np.clip(np.hypot(u_ice, v_ice), 0.02, 1.2)
            self.ice_drift_direction = _uv_to_dir(u_ice, v_ice)

            self.health['wind'] = {'live': bool(ok_w.any()), 'source': 'Open-Meteo NWP (GFS/ICON)',
                                   'updated': fetched}
            self.health['currents'] = {'live': bool(ok_c.any()), 'source': 'Open-Meteo marine (CMEMS)',
                                       'updated': fetched}
            self.health['waves'] = {'live': bool(ok_wv_h.any()), 'source': 'Open-Meteo marine (CMEMS)',
                                    'updated': fetched}
            self.health['ice_drift'] = {'live': True, 'source': 'Derived: 0.8*current + 0.02*wind',
                                        'updated': fetched}
        except Exception as e:
            print(f'[hybrid] metocean live failed, synthetic kept: {e}')
            for layer, src in (('wind', 'Synthetic (ERA5 schema)'),
                               ('currents', 'Synthetic (Copernicus schema)'),
                               ('waves', 'Synthetic (Copernicus schema)'),
                               ('ice_drift', 'Synthetic')):
                self.health[layer] = {'live': False, 'source': src, 'updated': None}

    # -- bergs: synthetic seeds, LIVE-forced drift -----------------------
    def get_initial_icebergs(self) -> List[Dict[str, Any]]:
        bergs = super().get_initial_icebergs()
        live = self.health.get('currents', {}).get('live') or self.health.get('wind', {}).get('live')
        if not live:
            return bergs
        out = []
        for b in bergs:
            r = int(np.clip((self.max_lat - b['latitude']) / (self.max_lat - self.min_lat) * (self.rows - 1), 0, self.rows - 1))
            c = int(np.clip((b['longitude'] - self.min_lon) / (self.max_lon - self.min_lon) * (self.cols - 1), 0, self.cols - 1))
            u = float(self.u_current[r, c]) + 0.02 * float(self.u_wind[r, c])
            v = float(self.v_current[r, c]) + 0.02 * float(self.v_wind[r, c])
            spd_ms = float(np.hypot(u, v))
            nb = dict(b)
            nb['drift_speed'] = round(spd_ms * 1.944, 2)  # m/s -> knots
            nb['drift_direction'] = round(float(_uv_to_dir(u, v)), 1)
            out.append(nb)
        return out

    def layer_health(self) -> List[Dict[str, Any]]:
        order = ['sea_ice', 'currents', 'wind', 'waves', 'bathymetry', 'ice_drift']
        labels = {'sea_ice': 'Sea ice', 'currents': 'Ocean currents', 'wind': 'Wind',
                  'waves': 'Waves', 'bathymetry': 'Bathymetry', 'ice_drift': 'Ice drift'}
        out = []
        for key in order:
            h = self.health.get(key, {'live': False, 'source': 'Synthetic', 'updated': None})
            out.append({'layer': labels[key], 'live': bool(h.get('live')),
                        'source': h.get('source', 'Synthetic'), 'updated': h.get('updated')})
        out.append({'layer': 'Icebergs', 'live': False, 'source': 'Synthetic seeds, live-forced drift',
                    'updated': None})
        out.append({'layer': 'History', 'live': False, 'source': 'Synthetic climatology', 'updated': None})
        return out

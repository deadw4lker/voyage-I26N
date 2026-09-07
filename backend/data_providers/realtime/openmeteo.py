"""
Real wind, waves and ocean currents from Open-Meteo (no API key).

- Wind: GFS/ICON-based NWP, 10 m U/V via speed+direction.
- Waves + currents: marine model (CMEMS-forced Global Ocean).
Values are the current-hour analysis on a coarse multi-point mesh and get
bilinearly resampled onto the 9 km ops grid by the hybrid provider.
Cached for 3 hours (NWP updates every 6 h).
"""

import time
import requests
import numpy as np
from .cache import load, load_stale, save, UA

TTL_S = 3 * 3600


def _coords(nlat: int, nlon: int, min_lat: float, max_lat: float,
            min_lon: float, max_lon: float):
    lats = np.linspace(min_lat, max_lat, nlat).tolist()
    lons = np.linspace(min_lon, max_lon, nlon).tolist()
    return lats, lons


def _current_or_first(obj: dict, key: str):
    """Prefer the `current` block; fall back to first hourly value."""
    if isinstance(obj.get('current'), dict) and obj['current'].get(key) is not None:
        return obj['current'][key]
    hourly = obj.get('hourly', {})
    vals = hourly.get(key)
    if vals:
        for v in vals:
            if v is not None:
                return v
    return None


def fetch_openmeteo(min_lat: float, max_lat: float, min_lon: float, max_lon: float,
                    nlat: int = 7, nlon: int = 9, timeout: int = 30) -> dict:
    """
    Returns {'lats','lons','wind_ms','wind_dir','wave_m','wave_dir',
    'current_ms','current_dir','fetched_at'} on the coarse mesh.
    Falls back to cache on failure.
    """
    name = f'openmeteo_{nlat}x{nlon}_{min_lat}_{max_lat}_{min_lon}_{max_lon}'
    try:
        lats, lons = _coords(nlat, nlon, min_lat, max_lat, min_lon, max_lon)
        # Build point list as lat[i],lon[j] pairs.
        plat, plon = [], []
        for la in lats:
            for lo in lons:
                plat.append(f'{la:.3f}')
                plon.append(f'{lo:.3f}')

        wf = requests.get(
            'https://api.open-meteo.com/v1/forecast',
            params={'latitude': ','.join(plat), 'longitude': ','.join(plon),
                    'current': 'wind_speed_10m,wind_direction_10m',
                    'hourly': 'wind_speed_10m,wind_direction_10m',
                    'wind_speed_unit': 'ms', 'forecast_days': 1, 'timezone': 'UTC'},
            headers={'User-Agent': UA}, timeout=timeout)
        wf.raise_for_status()
        wj = wf.json()
        wlist = wj if isinstance(wj, list) else [wj]

        wm = requests.get(
            'https://marine-api.open-meteo.com/v1/marine',
            params={'latitude': ','.join(plat), 'longitude': ','.join(plon),
                    'current': 'wave_height,wave_direction,ocean_current_velocity,ocean_current_direction',
                    'hourly': 'wave_height,wave_direction,ocean_current_velocity,ocean_current_direction',
                    'forecast_days': 1, 'timezone': 'UTC'},
            headers={'User-Agent': UA}, timeout=timeout)
        wm.raise_for_status()
        mj = wm.json()
        mlist = mj if isinstance(mj, list) else [mj]

        def grid_of(items, key, scale=1.0, default=None):
            vals = []
            for it in items:
                v = _current_or_first(it, key)
                vals.append(None if v is None else float(v) * scale)
            arr = np.array([[vals[r * nlon + c] for c in range(nlon)] for r in range(nlat)], dtype=float)
            if default is not None:
                arr = np.where(np.isnan(arr), default, arr)
            return arr

        wind_ms = grid_of(wlist, 'wind_speed_10m')
        wind_dir = grid_of(wlist, 'wind_direction_10m', default=220.0)
        wave_m = grid_of(mlist, 'wave_height')
        wave_dir = grid_of(mlist, 'wave_direction', default=280.0)
        # Marine currents come as km/h -> m/s.
        cur_ms = grid_of(mlist, 'ocean_current_velocity', scale=1.0 / 3.6)
        cur_dir = grid_of(mlist, 'ocean_current_direction', default=90.0)

        payload = {
            'lats': lats, 'lons': lons,
            'wind_ms': wind_ms.tolist(), 'wind_dir': wind_dir.tolist(),
            'wave_m': wave_m.tolist(), 'wave_dir': wave_dir.tolist(),
            'current_ms': cur_ms.tolist(), 'current_dir': cur_dir.tolist(),
            'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        save(name, payload)
        return payload
    except Exception as e:
        stale = load_stale(name)
        if stale:
            return stale
        raise RuntimeError(f'Open-Meteo unavailable and no cache: {e}')

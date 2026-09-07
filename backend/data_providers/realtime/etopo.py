"""
Real bathymetry from ETOPO relief via CoastWatch ERDDAP (no API key).

`altitude` is metres above sea level (positive = land/ice sheet).
Depth for ocean cells is -altitude; land cells get a nominal shallow depth
so the MCDM grounding-risk term treats the coastline as hazardous.
Static terrain: cached for 30 days.
"""

import time
import requests
from .cache import load, load_stale, save, UA

ERDDAP = 'https://coastwatch.pfeg.noaa.gov/erddap'
DATASET = 'etopo180'
TTL_S = 30 * 24 * 3600


def fetch_etopo_depth(min_lat: float, max_lat: float, min_lon: float, max_lon: float,
                      timeout: int = 30) -> dict:
    """
    Returns {'lats', 'lons', 'depth_m'} with depth positive-down in metres,
    rows south->north, cols west->east. Falls back to cache on failure.
    """
    name = f'etopo_{min_lat}_{max_lat}_{min_lon}_{max_lon}'
    cached = load(name, TTL_S)
    if cached:
        return cached
    try:
        q = (f'{ERDDAP}/griddap/{DATASET}.json?altitude'
             f'[({min_lat}):12:({max_lat})][({min_lon}):20:({max_lon})]')
        r = requests.get(q, headers={'User-Agent': UA}, timeout=timeout)
        r.raise_for_status()
        rows = r.json()['table']['rows']
        cells: dict = {}
        lats, lons = set(), set()
        for la, lo, alt in rows:
            lats.add(la)
            lons.add(lo)
            cells[(la, lo)] = float(alt)
        lats = sorted(lats)
        lons = sorted(lons)

        def depth(alt: float) -> float:
            return round(-alt, 1) if alt < 0 else 60.0

        grid = [[depth(cells[(la, lo)]) for lo in lons] for la in lats]
        payload = {'lats': lats, 'lons': lons, 'depth_m': grid,
                   'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        save(name, payload)
        return payload
    except Exception as e:
        stale = load_stale(name)
        if stale:
            return stale
        raise RuntimeError(f'ETOPO unavailable and no cache: {e}')

"""
Real sea-ice concentration from NOAA OISST v2.1 (NRT) via CoastWatch ERDDAP.

No API key required. Daily 0.25-degree global analysis combining satellite,
ship and buoy observations. `ice` is the sea-ice concentration fraction
(0..1); null marks land or missing cells.
"""

import time
import requests
from .cache import load, load_stale, save, UA

ERDDAP = 'https://coastwatch.pfeg.noaa.gov/erddap'
DATASET = 'ncdcOisst21NrtAgg'
TTL_S = 24 * 3600


def _latest_date(timeout: int = 15) -> str:
    cached = load('oisst_latest', TTL_S)
    if cached:
        return cached['date']
    url = f'{ERDDAP}/info/{DATASET}/index.json'
    r = requests.get(url, headers={'User-Agent': UA}, timeout=timeout)
    r.raise_for_status()
    info = r.json()
    row = next(
        x for x in info['table']['rows']
        if x[0] == 'attribute' and x[1] == 'NC_GLOBAL' and x[2] == 'time_coverage_end'
    )
    date = row[4][:10]
    save('oisst_latest', {'date': date})
    return date


def fetch_oisst_ice(min_lat: float, max_lat: float, min_lon: float, max_lon: float,
                    timeout: int = 30) -> dict:
    """
    Returns {'date', 'lats', 'lons', 'ice'} with ice as rows south->north,
    each row a list west->east of float|null.
    Falls back to last-known-good cache on any failure.
    """
    name = f'oisst_{min_lat}_{max_lat}_{min_lon}_{max_lon}'
    try:
        date = _latest_date()
        # 0.5-degree stride keeps the response small; the ops grid is 9 km.
        q = (f'{ERDDAP}/griddap/{DATASET}.json?ice[({date}):1:({date})]'
             f'[(0.0):1:(0.0)][({min_lat}):2:({max_lat})][({min_lon}):2:({max_lon})]')
        r = requests.get(q, headers={'User-Agent': UA}, timeout=timeout)
        r.raise_for_status()
        rows = r.json()['table']['rows']
        cells: dict = {}
        lats, lons = set(), set()
        for _t, _z, la, lo, ice in rows:
            lats.add(la)
            lons.add(lo)
            cells[(la, lo)] = None if ice is None else round(float(ice), 3)
        lats = sorted(lats)
        lons = sorted(lons)
        grid = [[cells.get((la, lo)) for lo in lons] for la in lats]
        payload = {'date': date, 'lats': lats, 'lons': lons,
                   'ice': grid, 'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        save(name, payload)
        return payload
    except Exception as e:
        stale = load_stale(name) or load_stale('oisst_latest')
        if stale and 'ice' in stale:
            return stale
        raise RuntimeError(f'OISST unavailable and no cache: {e}')

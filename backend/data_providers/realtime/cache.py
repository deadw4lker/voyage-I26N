"""
Disk cache for live data fetchers.

Each upstream response is stored as JSON under backend/data_cache/ with a
saved_at timestamp. On upstream failure or TTL expiry the caller falls back
to synthetic values, so the SIH demo never breaks when the network does.
"""

import json
import os
import time

CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data_cache')

UA = 'Voyage-I26N/1.0 (+sih-demo; realtime-layer-cache)'


def _path(name: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    safe = ''.join(c if (c.isalnum() or c in '-_.') else '_' for c in name)
    return os.path.join(CACHE_DIR, safe + '.json')


def load(name: str, ttl_s: float):
    """Returns cached payload dict, or None on miss/expiry/corruption."""
    try:
        with open(_path(name), 'r') as f:
            doc = json.load(f)
        if time.time() - float(doc.get('saved_at', 0)) > ttl_s:
            return None
        return doc.get('payload')
    except Exception:
        return None


def load_stale(name: str):
    """Returns cached payload regardless of age (last-known-good)."""
    try:
        with open(_path(name), 'r') as f:
            return json.load(f).get('payload')
    except Exception:
        return None


def save(name: str, payload) -> None:
    try:
        with open(_path(name), 'w') as f:
            json.dump({'saved_at': time.time(), 'payload': payload}, f)
    except Exception:
        pass

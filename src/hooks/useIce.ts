import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchIceStatus, fetchIceWindow, type IceStatus, type IceWindow, type IceWindowParams } from '../lib/ice';

export type IceLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface IceFeed {
  state: IceLoadState;
  data: IceWindow | null;
  status: IceStatus | null;
  error: string | null;
  retry: () => void;
}

const keyOf = (p: IceWindowParams) =>
  [p.minLat, p.maxLat, p.minLon, p.maxLon, p.stride ?? 4, p.days ?? 7].join('|');

/**
 * Loads the status + 7-day ice window once per bbox. Daily source data, so
 * no polling — the caller re-requests on explicit retry only.
 */
export function useIceWindow(params: IceWindowParams): IceFeed {
  const [state, setState] = useState<IceLoadState>('idle');
  const [data, setData] = useState<IceWindow | null>(null);
  const [status, setStatus] = useState<IceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = keyOf(params);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState('loading');
    setError(null);

    (async () => {
      try {
        const [st, win] = await Promise.all([
          fetchIceStatus(),
          fetchIceWindow({ ...params, stride: params.stride ?? 4, days: params.days ?? 7 }),
        ]);
        if (ctrl.signal.aborted) return;
        setStatus(st);
        setData(win);
        setState('ready');
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'ice feed unavailable');
        setState('error');
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { state, data, status, error, retry };
}

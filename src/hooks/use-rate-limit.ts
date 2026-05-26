import { useState, useEffect, useCallback, useRef } from 'react';

export interface RlSnapshot {
  tier: string;
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

interface RateLimitStatus {
  tier: string;
  limit: number | null;
  remaining: number | null;
  reset: number | null;
  loading: boolean;
  error: boolean;
}

export function useRateLimit(apiKey: string) {
  const [rlStatus, setRlStatus] = useState<RateLimitStatus>({
    tier: 'anonymous', limit: 30, remaining: null, reset: null, loading: false, error: false,
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const fetchingRl = useRef(false);

  const applyRlSnapshot = useCallback((snap: RlSnapshot) => {
    setRlStatus((s) => ({
      ...s,
      tier: snap.tier,
      limit: snap.limit,
      remaining: snap.remaining,
      reset: snap.reset,
      loading: false,
      error: false,
    }));
  }, []);

  // Countdown timer: ticks toward reset, restores bar at 0
  useEffect(() => {
    if (!rlStatus.reset || rlStatus.tier === 'master' || rlStatus.remaining === null || rlStatus.limit === null || rlStatus.remaining >= rlStatus.limit) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, rlStatus.reset! - Math.floor(Date.now() / 1000));
      if (secs === 0) {
        setCountdown(null);
        setRlStatus((s) => ({ ...s, remaining: s.limit }));
      } else {
        setCountdown(secs);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [rlStatus.reset, rlStatus.tier, rlStatus.remaining, rlStatus.limit]);

  const checkRateLimit = useCallback(async (key: string) => {
    if (fetchingRl.current) return;
    fetchingRl.current = true;
    setRlStatus((s) => ({ ...s, loading: true, error: false }));

    try {
      const headers: HeadersInit = {};
      if (key.trim()) headers['X-API-Key'] = key.trim();

      const res = await fetch('/api/icons?limit=1', { headers, cache: 'no-store' });

      const tier      = res.headers.get('x-ratelimit-tier') ?? 'anonymous';
      const limit     = res.headers.get('x-ratelimit-limit');
      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset     = res.headers.get('x-ratelimit-reset');

      setRlStatus({
        tier,
        limit:     limit     ? parseInt(limit)     : null,
        remaining: remaining ? parseInt(remaining) : null,
        reset:     reset     ? parseInt(reset)     : null,
        loading: false,
        error: false,
      });
    } catch {
      setRlStatus((s) => ({ ...s, loading: false, error: true }));
    } finally {
      fetchingRl.current = false;
    }
  }, []);

  // Check on mount and on key change (debounced)
  useEffect(() => {
    const id = setTimeout(() => checkRateLimit(apiKey), 400);
    return () => clearTimeout(id);
  }, [apiKey, checkRateLimit]);

  return { rlStatus, countdown, applyRlSnapshot, checkRateLimit };
}

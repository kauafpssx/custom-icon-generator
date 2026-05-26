import { createHash, timingSafeEqual } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

export type Tier = 'anonymous' | 'basic' | 'master';

export interface RateLimitResult {
  allowed: boolean;
  tier: Tier;
  limit: number;      // -1 = unlimited (master)
  remaining: number;  // -1 = count unknown
  reset: number;      // unix seconds
  retryAfter?: number;
  identifier?: string;
}

// ── Configured limits ─────────────────────────────────────────────────────────
const ANON_REQUESTS  = 30;
const BASIC_REQUESTS = 200;
const WINDOW_MS      = 60_000; // 1 minute sliding window

export const TIER_LIMIT: Record<'anonymous' | 'basic', number> = {
  anonymous: ANON_REQUESTS,
  basic:     BASIC_REQUESTS,
};

export interface RateLimitOverrides {
  anon?: number;
  basic?: number;
}

// ── Persistent state (survives Vite HMR module re-evaluation) ────────────────
const _g = globalThis as typeof globalThis & {
  __rl?: {
    memStore: Map<string, number[]>;
    redis: any | null | undefined;
    limiters: Map<string, any>;
    lastEvict: number;
  };
};
if (!_g.__rl) {
  _g.__rl = { memStore: new Map(), redis: undefined, limiters: new Map(), lastEvict: Date.now() };
}
const _state = _g.__rl;

// ── In-memory sliding window (fallback + dev) ─────────────────────────────────
// Works per process instance. On Vercel, each warm instance enforces independently.
// Not perfect for distributed rate limiting, but real enforcement vs fail-open.
const _memStore = _state.memStore;

// Evict stale buckets every 5 min to prevent unbounded growth
let _lastEvict = _state.lastEvict;
function evictStale() {
  const now = Date.now();
  if (now - _lastEvict < 300_000) return;
  _lastEvict = now;
  _state.lastEvict = now;
  const cutoff = now - WINDOW_MS;
  for (const [key, ts] of _memStore) {
    const fresh = ts.filter(t => t > cutoff);
    if (fresh.length === 0) _memStore.delete(key);
    else _memStore.set(key, fresh);
  }
}

function inMemoryCheck(
  identifier: string,
  maxRequests: number,
): { success: boolean; remaining: number; reset: number } {
  evictStale();
  const now      = Date.now();
  const cutoff   = now - WINDOW_MS;
  const prev     = (_memStore.get(identifier) ?? []).filter(t => t > cutoff);
  const count    = prev.length;
  const success  = count < maxRequests;

  if (success) {
    prev.push(now);
    _memStore.set(identifier, prev);
  }

  const oldest  = prev[0] ?? now;
  const resetMs = oldest + WINDOW_MS;
  return {
    success,
    remaining: Math.max(0, maxRequests - prev.length),
    reset:     Math.ceil(resetMs / 1000),
  };
}

// ── Upstash Redis (optional, enhances to distributed RL) ─────────────────────
async function tryGetRatelimit(tier: 'anon' | 'basic', max: number): Promise<import('@upstash/ratelimit').Ratelimit | null> {
  if (_state.redis === null) return null;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _state.redis = null;
    return null;
  }

  if (_state.redis === undefined) {
    try {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({ url, token });

      // Smoke-test the connection with a short timeout
      await Promise.race([
        redis.set('__rl_probe__', '1', { ex: 5 }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Redis timeout')), 3000)),
      ]);

      _state.redis = redis;
      console.log('[ratelimit] Connected to Upstash Redis');
    } catch (err) {
      console.warn('[ratelimit] Upstash unavailable, using in-memory RL:', (err as Error).message);
      _state.redis = null;
      return null;
    }
  }

  const redis = _state.redis;
  if (!redis) return null;

  const key = `${tier}:${max}`;
  if (_state.limiters.has(key)) {
    return _state.limiters.get(key);
  }

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, '1 m'),
      prefix: `rl:${tier}:${max}`,
    });
    _state.limiters.set(key, limiter);
    return limiter;
  } catch (err) {
    console.error('[ratelimit] Failed to create Ratelimit instance:', err);
    return null;
  }
}

// ── Key helpers ───────────────────────────────────────────────────────────────
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function loadEnvKeys(envVar: string): string[] {
  return (process.env[envVar] ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function extractRawKey(req: IncomingMessage): string {
  const auth = ((req.headers['authorization'] as string) ?? '').trim();
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return ((req.headers['x-api-key'] as string) ?? '').trim();
}

// ── IP extraction ─────────────────────────────────────────────────────────────
// Only the first IP in x-forwarded-for — prevents client-injected spoofing.
export function getClientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (raw) {
    const first = raw.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) return (Array.isArray(realIp) ? realIp[0] : realIp).trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

// ── Auth resolution ───────────────────────────────────────────────────────────
interface AuthResult {
  tier: Tier;
  identifier: string;
}

function resolveAuth(req: IncomingMessage): AuthResult {
  const rawKey = extractRawKey(req);
  const ip     = getClientIp(req);

  if (!rawKey) return { tier: 'anonymous', identifier: ip };

  for (const k of loadEnvKeys('API_KEYS_MASTER')) {
    if (safeEqual(rawKey, k)) return { tier: 'master', identifier: '' };
  }

  for (const k of loadEnvKeys('API_KEYS_BASIC')) {
    if (safeEqual(rawKey, k)) {
      const id = createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
      return { tier: 'basic', identifier: id };
    }
  }

  // Unrecognized key → anonymous. Never reveal key existence.
  return { tier: 'anonymous', identifier: ip };
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function checkRateLimit(req: IncomingMessage, overrides?: RateLimitOverrides): Promise<RateLimitResult> {
  const { tier, identifier } = resolveAuth(req);

  if (tier === 'master') {
    return { allowed: true, tier, limit: -1, remaining: -1, reset: 0, identifier };
  }

  const max  = tier === 'basic'
    ? (overrides?.basic ?? TIER_LIMIT.basic)
    : (overrides?.anon  ?? TIER_LIMIT.anonymous);
  const limiter = await tryGetRatelimit(tier === 'basic' ? 'basic' : 'anon', max);

  if (limiter) {
    // Distributed rate limiting via Upstash Redis
    try {
      const r        = await limiter.limit(identifier);
      const resetSec = Math.ceil(r.reset / 1000);
      const now      = Math.floor(Date.now() / 1000);

      return {
        allowed:    r.success,
        tier,
        limit:      r.limit,
        remaining:  r.remaining,
        reset:      resetSec,
        retryAfter: r.success ? undefined : Math.max(1, resetSec - now),
        identifier,
      };
    } catch (err) {
      // Redis failed mid-flight — invalidate singleton so next request retries
      console.error('[ratelimit] Redis mid-flight error, falling back to in-memory:', err);
      _state.redis = undefined;
      _state.limiters.clear();
    }
  }

  // In-memory sliding window — always enforces, even without Redis
  const r        = inMemoryCheck(identifier, max);
  const now      = Math.floor(Date.now() / 1000);

  return {
    allowed:    r.success,
    tier,
    limit:      max,
    remaining:  r.remaining,
    reset:      r.reset,
    retryAfter: r.success ? undefined : Math.max(1, r.reset - now),
    identifier,
  };
}

export function applyRateLimitHeaders(res: ServerResponse, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Tier', result.tier);

  if (result.identifier) {
    res.setHeader('X-RateLimit-Identifier', result.identifier);
  }

  if (result.limit !== -1) {
    res.setHeader('X-RateLimit-Limit', String(result.limit));

    if (result.remaining !== -1) {
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset',     String(result.reset));
    }
  }

  if (result.retryAfter !== undefined) {
    res.setHeader('Retry-After', String(result.retryAfter));
  }
}

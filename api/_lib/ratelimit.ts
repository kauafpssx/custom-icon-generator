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
// In dev mode, Vite can re-evaluate this module on each request, which would
// reset plain `const` Maps to empty. Storing state on globalThis ensures the
// sliding-window counters persist across reloads for the lifetime of the process.
const _g = globalThis as typeof globalThis & {
  __rl?: {
    memStore: Map<string, number[]>;
    pair: LimiterPair | null | undefined;
    lastEvict: number;
  };
};
if (!_g.__rl) {
  _g.__rl = { memStore: new Map(), pair: undefined, lastEvict: Date.now() };
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
interface LimiterPair {
  anon:  import('@upstash/ratelimit').Ratelimit;
  basic: import('@upstash/ratelimit').Ratelimit;
}

async function tryGetPair(): Promise<LimiterPair | null> {
  if (_state.pair !== undefined) return _state.pair;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    _state.pair = null;
    return null;
  }

  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ]);

    const redis = new Redis({ url, token });

    // Smoke-test the connection with a short timeout
    await Promise.race([
      redis.set('__rl_probe__', '1', { ex: 5 }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Redis timeout')), 3000)),
    ]);

    _state.pair = {
      anon: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(ANON_REQUESTS, '1 m'),
        prefix: 'rl:anon',
      }),
      basic: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(BASIC_REQUESTS, '1 m'),
        prefix: 'rl:basic',
      }),
    };

    console.log('[ratelimit] Connected to Upstash Redis — distributed RL active');
  } catch (err) {
    console.warn('[ratelimit] Upstash unavailable, using in-memory RL:', (err as Error).message);
    _state.pair = null;
  }

  return _state.pair;
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
    return { allowed: true, tier, limit: -1, remaining: -1, reset: 0 };
  }

  const max  = tier === 'basic'
    ? (overrides?.basic ?? TIER_LIMIT.basic)
    : (overrides?.anon  ?? TIER_LIMIT.anonymous);
  const pair = await tryGetPair();

  if (pair) {
    // Distributed rate limiting via Upstash Redis
    try {
      const limiter  = tier === 'basic' ? pair.basic : pair.anon;
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
      };
    } catch (err) {
      // Redis failed mid-flight — invalidate singleton so next request retries
      console.error('[ratelimit] Redis mid-flight error, falling back to in-memory:', err);
      _state.pair = undefined;
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
  };
}

export function applyRateLimitHeaders(res: ServerResponse, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Tier', result.tier);

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

import type { RateLimitOverrides } from './ratelimit.js';

export function parseColor(param: string | string[] | undefined, defaultHex: string): string {
  if (!param) return `#${defaultHex}`;
  const s = Array.isArray(param) ? param[0] : param;
  if (s.toLowerCase() === 'brand')  return `#${defaultHex}`;
  if (s.toLowerCase() === 'random') return `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
  if (/^[0-9A-Fa-f]{3,6}$/.test(s)) return `#${s}`;
  if (s.startsWith('#')) return s;
  return s;
}

export function parseSize(param: string | string[] | undefined): number {
  const s = (Array.isArray(param) ? param[0] : param) ?? '';
  if (!s) return 0;
  if (s.toLowerCase() === 'random') return Math.floor(Math.random() * 497) + 16;
  return Math.max(16, Math.min(512, parseInt(s, 10) || 128));
}

export function parseBackground(param: string | string[] | undefined): string | undefined {
  if (!param) return undefined;
  const s = Array.isArray(param) ? param[0] : param;
  const lower = s.toLowerCase();
  if (lower === 'default') return 'default';
  if (lower === 'transparent') return 'transparent';
  if (s.startsWith('#') && /^#[0-9A-Fa-f]{3,6}$/.test(s)) return s;
  if (/^[0-9A-Fa-f]{3,6}$/.test(s)) return `#${s}`;
  return undefined;
}

export function getParam(val: string | string[] | undefined, fallback = ''): string {
  return (Array.isArray(val) ? val[0] : val) ?? fallback;
}

// Per-endpoint rate limit overrides — protects expensive routes while keeping metadata accessible.
export function endpointLimits(pathname: string, action: string | string[] | undefined): RateLimitOverrides {
  const act = Array.isArray(action) ? action[0] : (action ?? '');

  if (act === 'icons-all' || pathname === '/api/icons/all') {
    return { anon: 5, basic: 30 };
  }
  if (
    pathname.endsWith('.png') || pathname.endsWith('.ico') ||
    (pathname.startsWith('/api/asset/') && (pathname.endsWith('.png') || pathname.endsWith('.ico')))
  ) {
    return { anon: 20, basic: 150 };
  }
  if (pathname.endsWith('.svg') || (pathname.startsWith('/api/asset/') && !pathname.endsWith('.json'))) {
    return { anon: 60, basic: 400 };
  }
  return { anon: 200, basic: 800 };
}

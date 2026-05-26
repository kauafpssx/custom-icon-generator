import { IncomingMessage, ServerResponse } from 'http';
import url from 'url';
import { checkRateLimit, applyRateLimitHeaders } from './ratelimit.js';
import { getAllIcons, findIcon, getVersion, searchIcons } from './icons.js';
import { buildSvg, svgToPng, pngToIco, iconJsonBody } from './render.js';
import { parseColor, parseSize, getParam, endpointLimits } from './params.js';

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Access-Control-Expose-Headers',
    'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Tier, Retry-After, X-RateLimit-Identifier');
}

function send429(res: ServerResponse, retryAfter: number): void {
  res.statusCode = 429;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: 'Rate limit exceeded',
    message: `Too many requests. Retry after ${retryAfter}s. Use an API key for higher limits.`,
    retryAfter,
  }));
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    return await _handleApiRequest(req, res);
  } catch (err) {
    console.error('[api] unhandled error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error', message: String(err) }));
    }
  }
}

async function _handleApiRequest(req: IncomingMessage, res: ServerResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const parsed   = url.parse(req.url || '', true);
  const pathname = parsed.pathname || '';
  const query    = parsed.query;

  // Rate limiting — applied before any work is done.
  // Limits vary by endpoint cost; metadata routes are more permissive than raster routes.
  let rl: Awaited<ReturnType<typeof checkRateLimit>>;
  try {
    rl = await checkRateLimit(req, endpointLimits(pathname, query.action));
  } catch (err) {
    console.error('[api] checkRateLimit threw unexpectedly:', err);
    rl = { allowed: true, tier: 'anonymous', limit: -1, remaining: -1, reset: 0 };
  }
  applyRateLimitHeaders(res, rl);

  if (!rl.allowed) {
    send429(res, rl.retryAfter ?? 60);
    return;
  }

  // GET /api/search?q=&limit=
  if (query.action === 'search' || pathname === '/api/search') {
    const q     = getParam(query.q);
    const limit = Math.min(parseInt(getParam(query.limit, '10'), 10) || 10, 100);

    if (!q.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing required query param: q' }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.end(JSON.stringify(await searchIcons(q, limit)));
    return;
  }

  // GET /api/stats
  if (query.action === 'stats' || pathname === '/api/stats') {
    const icons   = await getAllIcons();
    const version = await getVersion();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.end(JSON.stringify({
      total: icons.length,
      version,
      formats: ['svg', 'png', 'ico', 'json'],
      rateLimit: {
        anonymous: { requests: 30,  window: '1m', per: 'IP'  },
        basic:     { requests: 200, window: '1m', per: 'key' },
        master:    { requests: -1,  window: null, per: 'key' },
      },
    }));
    return;
  }

  // GET /api/icons/all — full list with path data
  if (query.action === 'icons-all' || pathname === '/api/icons/all') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.end(JSON.stringify(await getAllIcons()));
    return;
  }

  // GET /api/icons — lightweight list, optional ?page=&limit=
  if (query.action === 'icons' || pathname === '/api/icons') {
    const list  = (await getAllIcons()).map(({ title, slug, hex }) => ({ title, slug, hex }));
    const limit = parseInt(getParam(query.limit, '0'), 10) || 0;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');

    if (limit > 0) {
      const page  = parseInt(getParam(query.page, '1'), 10) || 1;
      const cap   = Math.min(limit, 1000);
      const start = (page - 1) * cap;
      res.end(JSON.stringify({
        total: list.length,
        page,
        limit: cap,
        pages: Math.ceil(list.length / cap),
        icons: list.slice(start, start + cap),
      }));
    } else {
      res.end(JSON.stringify(list));
    }
    return;
  }

  // GET /api/icons/:slug — single icon JSON metadata
  if (query.action === 'icon-slug' || (pathname.startsWith('/api/icons/') && pathname !== '/api/icons/all')) {
    const slugPart = query.action === 'icon-slug'
      ? getParam(query.slug)
      : pathname.substring('/api/icons/'.length);
    if (slugPart) {
      const icon = await findIcon(slugPart);
      if (!icon) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Icon '${slugPart}' not found` }));
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(JSON.stringify(iconJsonBody(icon)));
      return;
    }
  }

  // GET /api/random[.svg|.png|.ico|.json]
  if (query.action === 'random' || pathname.startsWith('/api/random')) {
    let format = 'svg';
    if (pathname.endsWith('.png'))       format = 'png';
    else if (pathname.endsWith('.ico'))  format = 'ico';
    else if (pathname.endsWith('.json')) format = 'json';

    const allIcons = await getAllIcons();
    const icon     = allIcons[Math.floor(Math.random() * allIcons.length)];

    res.setHeader('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (format === 'json') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(iconJsonBody(icon)));
      return;
    }

    const color   = parseColor(query.color, icon.hex);
    const sizeVal = parseSize(query.size);

    if (format === 'svg') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.end(buildSvg(icon, color, sizeVal || undefined));
      return;
    }

    const rasterSize = sizeVal || 128;
    try {
      const png = await svgToPng(buildSvg(icon, color), rasterSize);
      res.statusCode = 200;
      res.setHeader('Content-Type', format === 'ico' ? 'image/x-icon' : 'image/png');
      res.end(format === 'ico' ? pngToIco(png, rasterSize) : png);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Render failed', message: String(err) }));
    }
    return;
  }

  // GET /api/asset/:slug (.svg | .png | .ico | .json)
  let slugParam = '';
  if (query.slug) {
    slugParam = getParam(query.slug);
  } else if (pathname.startsWith('/api/asset/')) {
    slugParam = pathname.substring('/api/asset/'.length);
  }

  if (slugParam) {
    let format    = 'svg';
    let cleanSlug = slugParam;

    if (slugParam.endsWith('.svg'))       { format = 'svg';  cleanSlug = slugParam.slice(0, -4); }
    else if (slugParam.endsWith('.png'))  { format = 'png';  cleanSlug = slugParam.slice(0, -4); }
    else if (slugParam.endsWith('.ico'))  { format = 'ico';  cleanSlug = slugParam.slice(0, -4); }
    else if (slugParam.endsWith('.json')) { format = 'json'; cleanSlug = slugParam.slice(0, -5); }

    const icon = await findIcon(cleanSlug);

    if (!icon) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Icon '${cleanSlug}' not found` }));
      return;
    }

    const isRandomColor = typeof query.color === 'string' && query.color.toLowerCase() === 'random';
    const isRandomSize  = typeof query.size === 'string' && query.size.toLowerCase() === 'random';

    if (isRandomColor || isRandomSize) {
      res.setHeader('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    if (format === 'json') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(iconJsonBody(icon)));
      return;
    }

    const color   = parseColor(query.color, icon.hex);
    const sizeVal = parseSize(query.size);

    if (format === 'svg') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.end(buildSvg(icon, color, sizeVal || undefined));
      return;
    }

    const rasterSize = sizeVal || 128;

    try {
      const png = await svgToPng(buildSvg(icon, color), rasterSize);

      if (format === 'png') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.end(png);
        return;
      }

      if (format === 'ico') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/x-icon');
        res.end(pngToIco(png, rasterSize));
        return;
      }
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Render failed', message: String(err) }));
      return;
    }
  }

  // GET /api — redirect to React playground
  if (pathname === '/api' || pathname === '/api/') {
    res.statusCode = 301;
    res.setHeader('Location', '/playground');
    res.end();
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found. Visit /playground for documentation.' }));
}

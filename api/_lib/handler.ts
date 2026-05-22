import { IncomingMessage, ServerResponse } from 'http';
import * as simpleIcons from 'simple-icons';
import url from 'url';

let _allIcons: { title: string; slug: string; hex: string; path: string }[] | null = null;

function getAllIcons() {
  if (_allIcons) return _allIcons;
  _allIcons = Object.values(simpleIcons as Record<string, unknown>)
    .filter((icon): icon is { title: string; slug: string; hex: string; path: string } =>
      !!icon && typeof icon === 'object' && 'title' in icon && 'slug' in icon)
    .map((icon) => ({
      title: icon.title,
      slug: icon.slug,
      hex: icon.hex,
      path: icon.path,
    }));
  return _allIcons;
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  if (qi === q.length) return Math.max(1, Math.floor(30 * q.length / t.length));
  return 0;
}

function searchIcons(query: string, limit: number) {
  return getAllIcons()
    .map(icon => ({
      title: icon.title,
      slug: icon.slug,
      hex: icon.hex,
      score: Math.max(fuzzyScore(query, icon.title), Math.floor(fuzzyScore(query, icon.slug) * 0.9)),
    }))
    .filter(icon => icon.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function findIcon(slug: string) {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  return getAllIcons().find(icon => icon.slug.toLowerCase() === clean);
}

function parseColor(param: string | string[] | undefined, defaultHex: string): string {
  if (!param) return `#${defaultHex}`;
  const s = Array.isArray(param) ? param[0] : param;
  if (s.toLowerCase() === 'brand') return `#${defaultHex}`;
  if (/^[0-9A-Fa-f]{3,6}$/.test(s)) return `#${s}`;
  if (s.startsWith('#')) return s;
  return s;
}

function buildSvg(icon: { title: string; path: string }, color: string, size?: number): string {
  const sizeAttr = size ? ` width="${size}" height="${size}"` : '';
  return `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="${color}"${sizeAttr}><title>${icon.title}</title><path d="${icon.path}"/></svg>`;
}

async function svgToPng(svg: string, size: number): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return resvg.render().asPng();
}

function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  const s = size >= 256 ? 0 : size;
  entry.writeUInt8(s, 0);
  entry.writeUInt8(s, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png]);
}

function getParam(val: string | string[] | undefined, fallback = ''): string {
  return (Array.isArray(val) ? val[0] : val) ?? fallback;
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const parsed = url.parse(req.url || '', true);
  const pathname = parsed.pathname || '';
  const query = parsed.query;

  // GET /api/search?q=&limit=
  if (query.action === 'search' || pathname === '/api/search') {
    const q = getParam(query.q);
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
    res.end(JSON.stringify(searchIcons(q, limit)));
    return;
  }

  // GET /api/icons/all — full list with path data
  if (query.action === 'icons-all' || pathname === '/api/icons/all') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    res.end(JSON.stringify(getAllIcons()));
    return;
  }

  // GET /api/icons — lightweight list, optional ?page=&limit=
  if (query.action === 'icons' || pathname === '/api/icons') {
    const list = getAllIcons().map(({ title, slug, hex }) => ({ title, slug, hex }));
    const limit = parseInt(getParam(query.limit, '0'), 10) || 0;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');

    if (limit > 0) {
      const page = parseInt(getParam(query.page, '1'), 10) || 1;
      const cap = Math.min(limit, 1000);
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

  // GET /api/asset/:slug (.svg | .png | .ico | .json)
  let slugParam = '';
  if (query.slug) {
    slugParam = getParam(query.slug);
  } else if (pathname.startsWith('/api/asset/')) {
    slugParam = pathname.substring('/api/asset/'.length);
  }

  if (slugParam) {
    let format = 'svg';
    let cleanSlug = slugParam;

    if (slugParam.endsWith('.svg'))  { format = 'svg';  cleanSlug = slugParam.slice(0, -4); }
    else if (slugParam.endsWith('.png'))  { format = 'png';  cleanSlug = slugParam.slice(0, -4); }
    else if (slugParam.endsWith('.ico'))  { format = 'ico';  cleanSlug = slugParam.slice(0, -4); }
    else if (slugParam.endsWith('.json')) { format = 'json'; cleanSlug = slugParam.slice(0, -5); }

    const icon = findIcon(cleanSlug);

    if (!icon) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Icon '${cleanSlug}' not found` }));
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (format === 'json') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        title: icon.title,
        slug: icon.slug,
        hex: icon.hex,
        color: `#${icon.hex}`,
        path: icon.path,
        svg: buildSvg(icon, `#${icon.hex}`),
      }));
      return;
    }

    const color = parseColor(query.color, icon.hex);
    const sizeRaw = getParam(query.size);
    const sizeVal = sizeRaw ? Math.max(16, Math.min(512, parseInt(sizeRaw, 10) || 128)) : 0;

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


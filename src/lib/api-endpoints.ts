export interface ApiParam {
  name: string;
  loc: 'path' | 'query';
  type: 'string' | 'integer';
  required: boolean;
  desc: string;
  placeholder?: string;
  defaultValue?: string;
  isColor?: boolean;
  isSlug?: boolean;
}

export interface ApiEndpoint {
  id: string;
  tag: string;
  path: string;
  summary: string;
  desc: string;
  params: ApiParam[];
  responseType: 'json' | 'image';
}

export const API_TAGS = ['Icons', 'Assets', 'Random', 'Meta'] as const;

export const ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'search',
    tag: 'Icons',
    path: '/api/search',
    summary: 'Fuzzy search icons',
    desc: 'Search by name or slug using fuzzy matching. Returns results sorted by relevance score.',
    params: [
      { name: 'q', loc: 'query', type: 'string', required: true, desc: 'Search query', placeholder: 'github' },
      { name: 'limit', loc: 'query', type: 'integer', required: false, desc: 'Max results (1–100)', placeholder: '10', defaultValue: '10' },
    ],
    responseType: 'json',
  },
  {
    id: 'icons',
    tag: 'Icons',
    path: '/api/icons',
    summary: 'List icons (lightweight)',
    desc: 'Returns [{title, slug, hex}] for all icons. Add ?page=&limit= for pagination.',
    params: [
      { name: 'page', loc: 'query', type: 'integer', required: false, desc: 'Page number (requires limit)', placeholder: '1' },
      { name: 'limit', loc: 'query', type: 'integer', required: false, desc: 'Icons per page (0 = all)', placeholder: '50' },
    ],
    responseType: 'json',
  },
  {
    id: 'icons-all',
    tag: 'Icons',
    path: '/api/icons/all',
    summary: 'Full icon dataset',
    desc: 'All icons including SVG path data. Large response (~3MB). Cached 24h.',
    params: [],
    responseType: 'json',
  },
  {
    id: 'icon-slug',
    tag: 'Icons',
    path: '/api/icons/{slug}',
    summary: 'Get icon by slug',
    desc: 'Returns full JSON metadata for a single icon: title, slug, hex, path, svg, and optional source, guidelines, license.',
    params: [
      { name: 'slug', loc: 'path', type: 'string', required: true, desc: 'Icon slug', placeholder: 'react', defaultValue: 'react', isSlug: true },
    ],
    responseType: 'json',
  },
  {
    id: 'asset-svg',
    tag: 'Assets',
    path: '/api/asset/{slug}.svg',
    summary: 'Get SVG icon',
    desc: 'Returns an SVG image. Scalable and color-customizable.',
    params: [
      { name: 'slug', loc: 'path', type: 'string', required: true, desc: 'Icon slug', placeholder: 'react', defaultValue: 'react', isSlug: true },
      { name: 'color', loc: 'query', type: 'string', required: false, desc: 'Hex color, "brand" for the icon\'s default color, or "random"', isColor: true, defaultValue: 'brand' },
      { name: 'size', loc: 'query', type: 'string', required: false, desc: 'Width/height in pixels (16–512) or "random"', placeholder: '128' },
      { name: 'background', loc: 'query', type: 'string', required: false, desc: 'Background: "default" (white for PNG/ICO), "transparent", or a hex like "#ffffff"', placeholder: 'transparent' },
    ],
    responseType: 'image',
  },
  {
    id: 'asset-png',
    tag: 'Assets',
    path: '/api/asset/{slug}.png',
    summary: 'Get PNG icon',
    desc: 'Rasterized PNG image via resvg. Default 128×128px.',
    params: [
      { name: 'slug', loc: 'path', type: 'string', required: true, desc: 'Icon slug', placeholder: 'react', defaultValue: 'react', isSlug: true },
      { name: 'color', loc: 'query', type: 'string', required: false, desc: 'Hex color, "brand" for the icon\'s default color, or "random"', isColor: true, defaultValue: 'brand' },
      { name: 'size', loc: 'query', type: 'string', required: false, desc: 'Pixels (16–512) or "random"', placeholder: '128', defaultValue: '128' },
      { name: 'background', loc: 'query', type: 'string', required: false, desc: 'Background: "default" (white for PNG/ICO), "transparent", or a hex like "#ffffff"', placeholder: 'transparent' },
    ],
    responseType: 'image',
  },
  {
    id: 'asset-ico',
    tag: 'Assets',
    path: '/api/asset/{slug}.ico',
    summary: 'Get ICO icon',
    desc: 'ICO file (PNG-in-ICO). Ideal for favicons. Default 32×32px.',
    params: [
      { name: 'slug', loc: 'path', type: 'string', required: true, desc: 'Icon slug', placeholder: 'react', defaultValue: 'react', isSlug: true },
      { name: 'color', loc: 'query', type: 'string', required: false, desc: 'Hex color, "brand" for the icon\'s default color, or "random"', isColor: true, defaultValue: 'brand' },
      { name: 'size', loc: 'query', type: 'string', required: false, desc: 'Pixels (16–512) or "random"', placeholder: '32', defaultValue: '32' },
      { name: 'background', loc: 'query', type: 'string', required: false, desc: 'Background: "default" (white for PNG/ICO), "transparent", or a hex like "#ffffff"', placeholder: 'transparent' },
    ],
    responseType: 'image',
  },
  {
    id: 'asset-json',
    tag: 'Assets',
    path: '/api/asset/{slug}.json',
    summary: 'Get icon metadata',
    desc: 'Returns JSON with title, slug, hex, path, svg, and optional source, guidelines, license fields.',
    params: [
      { name: 'slug', loc: 'path', type: 'string', required: true, desc: 'Icon slug', placeholder: 'react', defaultValue: 'react', isSlug: true },
    ],
    responseType: 'json',
  },
  {
    id: 'random-svg',
    tag: 'Random',
    path: '/api/random.svg',
    summary: 'Random icon SVG',
    desc: 'Returns a random icon as SVG. Never cached. Supports ?color= and ?size=.',
    params: [
      { name: 'color', loc: 'query', type: 'string', required: false, desc: 'Hex color or "brand"', isColor: true, defaultValue: 'brand' },
      { name: 'size', loc: 'query', type: 'string', required: false, desc: 'Width/height in pixels (16–512) or "random"', placeholder: '128' },
      { name: 'background', loc: 'query', type: 'string', required: false, desc: 'Background: "default" (white for PNG/ICO), "transparent", or a hex like "#ffffff"', placeholder: 'transparent' },
    ],
    responseType: 'image',
  },
  {
    id: 'random-json',
    tag: 'Random',
    path: '/api/random.json',
    summary: 'Random icon metadata',
    desc: 'Returns a random icon as JSON with full metadata. Never cached.',
    params: [],
    responseType: 'json',
  },
  {
    id: 'stats',
    tag: 'Meta',
    path: '/api/stats',
    summary: 'API statistics',
    desc: 'Returns total icon count, simple-icons version, supported formats, and rate limit tiers.',
    params: [],
    responseType: 'json',
  },
];

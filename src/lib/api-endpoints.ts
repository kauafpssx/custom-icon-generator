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

export const API_TAGS = ['Icons', 'Assets'] as const;

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
    id: 'asset-svg',
    tag: 'Assets',
    path: '/api/asset/{slug}.svg',
    summary: 'Get SVG icon',
    desc: 'Returns an SVG image. Scalable and color-customizable.',
    params: [
      { name: 'slug', loc: 'path', type: 'string', required: true, desc: 'Icon slug', placeholder: 'react', defaultValue: 'react', isSlug: true },
      { name: 'color', loc: 'query', type: 'string', required: false, desc: 'Hex color or "brand" for the icon\'s default color', isColor: true, defaultValue: 'brand' },
      { name: 'size', loc: 'query', type: 'integer', required: false, desc: 'Width/height in pixels (16–512)', placeholder: '128' },
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
      { name: 'color', loc: 'query', type: 'string', required: false, desc: 'Hex color or "brand" for the icon\'s default color', isColor: true, defaultValue: 'brand' },
      { name: 'size', loc: 'query', type: 'integer', required: false, desc: 'Pixels (16–512)', placeholder: '128', defaultValue: '128' },
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
      { name: 'color', loc: 'query', type: 'string', required: false, desc: 'Hex color or "brand" for the icon\'s default color', isColor: true, defaultValue: 'brand' },
      { name: 'size', loc: 'query', type: 'integer', required: false, desc: 'Pixels (16–512)', placeholder: '32', defaultValue: '32' },
    ],
    responseType: 'image',
  },
  {
    id: 'asset-json',
    tag: 'Assets',
    path: '/api/asset/{slug}.json',
    summary: 'Get icon metadata',
    desc: 'Returns JSON with title, slug, hex, path, and a pre-built SVG string.',
    params: [
      { name: 'slug', loc: 'path', type: 'string', required: true, desc: 'Icon slug', placeholder: 'react', defaultValue: 'react', isSlug: true },
    ],
    responseType: 'json',
  },
];

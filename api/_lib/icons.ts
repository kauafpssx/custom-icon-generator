export type Icon = {
  title: string;
  slug: string;
  hex: string;
  path: string;
  source?: string;
  guidelines?: string;
  license?: { type: string; url: string };
};

let _allIcons: Icon[] | null = null;
let _simpleIconsVersion: string | null = null;

export async function getVersion(): Promise<string> {
  if (_simpleIconsVersion) return _simpleIconsVersion;
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pkg = require('simple-icons/package.json') as { version: string };
    _simpleIconsVersion = pkg.version ?? 'unknown';
  } catch {
    _simpleIconsVersion = 'unknown';
  }
  return _simpleIconsVersion!;
}

export async function getAllIcons(): Promise<Icon[]> {
  if (_allIcons) return _allIcons;
  const mod = await import('simple-icons') as Record<string, unknown>;
  _allIcons = Object.values(mod)
    .filter((icon): icon is Record<string, unknown> =>
      !!icon && typeof icon === 'object' && 'title' in icon && 'slug' in icon && 'hex' in icon && 'path' in icon)
    .map((icon) => {
      const out: Icon = {
        title:  icon.title as string,
        slug:   icon.slug as string,
        hex:    icon.hex as string,
        path:   icon.path as string,
      };
      if (typeof icon.source === 'string') out.source = icon.source;
      if (typeof icon.guidelines === 'string') out.guidelines = icon.guidelines;
      if (icon.license && typeof icon.license === 'object') {
        const lic = icon.license as Record<string, unknown>;
        if (typeof lic.type === 'string') {
          out.license = { type: lic.type, url: typeof lic.url === 'string' ? lic.url : '' };
        }
      }
      return out;
    });
  return _allIcons;
}

export async function findIcon(slug: string): Promise<Icon | undefined> {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (await getAllIcons()).find(icon => icon.slug.toLowerCase() === clean);
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

export async function searchIcons(query: string, limit: number) {
  return (await getAllIcons())
    .map(icon => ({
      title: icon.title,
      slug:  icon.slug,
      hex:   icon.hex,
      score: Math.max(fuzzyScore(query, icon.title), Math.floor(fuzzyScore(query, icon.slug) * 0.9)),
    }))
    .filter(icon => icon.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

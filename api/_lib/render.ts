import type { Icon } from './icons.js';

export function buildSvg(icon: { title: string; path: string }, color: string, size?: number, background?: string): string {
  const sizeAttr = size ? ` width="${size}" height="${size}"` : '';
  const bgRect = background ? `<rect width="100%" height="100%" fill="${background}"/>` : '';
  return `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="${color}"${sizeAttr}><title>${icon.title}</title>${bgRect}<path d="${icon.path}"/></svg>`;
}

export function iconJsonBody(icon: Icon): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: icon.title,
    slug:  icon.slug,
    hex:   icon.hex,
    color: `#${icon.hex}`,
    path:  icon.path,
    svg:   buildSvg(icon, `#${icon.hex}`),
  };
  if (icon.source)     body.source     = icon.source;
  if (icon.guidelines) body.guidelines = icon.guidelines;
  if (icon.license)    body.license    = icon.license;
  return body;
}

export async function svgToPng(svg: string, size: number, background?: string): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js');
  const options: Record<string, unknown> = { fitTo: { mode: 'width', value: size } };
  if (background) options.background = background;
  const resvg = new Resvg(svg, options);
  return resvg.render().asPng();
}

export function pngToIco(png: Buffer, size: number): Buffer {
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

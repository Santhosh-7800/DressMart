/**
 * One-off generator for the 30 hand-specified curated Checked Shirt products (CS001-CS030). There is
 * no real photography for these — produces genuinely distinct, procedurally-rendered SVG images, 5
 * per product, into its own dedicated subfolder, so no two products (and no other category) ever
 * share a file. Not meant to run automatically; re-run by hand only if scripts/curatedCheckedShirtsData.ts changes:
 *   npx tsx scripts/generateCuratedCheckedShirtImages.ts
 *
 * Output: public/images/products/men/checked-shirts/CS0XX/1.svg .. 5.svg
 * (Nested per-product folders — safe here because this curated batch hardcodes its own image URLs
 * directly in scripts/seedCuratedCheckedShirts.ts rather than going through
 * scripts/generateImageManifest.ts's flat-file scanner, which the generic round-robin catalog uses.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURATED_CHECKED_SHIRTS, type CuratedCheckedShirt } from './curatedCheckedShirtsData';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'frontend/public/images/products/men/checked-shirts');

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function checkPatternDefs(id: string, base: string, accent: string, cell: number, offset: number, third?: string, fourth?: string): string {
  const extra = third
    ? `
      <rect width="${cell / 2}" height="${cell / 2}" fill="${third}" opacity="0.5" />
      <rect x="${cell / 2}" y="${cell / 2}" width="${cell / 2}" height="${cell / 2}" fill="${fourth ?? third}" opacity="0.5" />`
    : '';
  return `
    <pattern id="${id}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse" patternTransform="translate(${offset},${offset})">
      <rect width="${cell}" height="${cell}" fill="${base}" />
      <rect width="${cell}" height="${cell / 3}" fill="${accent}" opacity="0.55" />
      <rect y="${cell / 2}" width="${cell}" height="${cell / 3}" fill="${accent}" opacity="0.4" />
      <rect width="${cell / 3}" height="${cell}" fill="${accent}" opacity="0.3" />${extra}
    </pattern>`;
}

function shirtFrontSvg(id: string, name: string, colorLabel: string, base: string, accent: string, third?: string, fourth?: string): string {
  const patId = `p-${id}-front`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img" aria-label="${escapeXml(name)} — ${escapeXml(colorLabel)}, front view">
  <defs>${checkPatternDefs(patId, base, accent, 28, 4, third, fourth)}</defs>
  <rect width="480" height="600" fill="#F3F4F6" />
  <g>
    <path d="M150 90 L180 60 L240 90 L300 60 L330 90 L330 130 L300 150 L300 540 L180 540 L180 150 L150 130 Z" fill="url(#${patId})" stroke="#00000022" stroke-width="2" />
    <path d="M180 60 L240 90 L210 110 Z" fill="${base}" />
    <path d="M300 60 L240 90 L270 110 Z" fill="${base}" />
    <line x1="240" y1="90" x2="240" y2="540" stroke="#00000022" stroke-width="2" />
    <circle cx="240" cy="180" r="4" fill="#00000033" />
    <circle cx="240" cy="240" r="4" fill="#00000033" />
    <circle cx="240" cy="300" r="4" fill="#00000033" />
    <circle cx="240" cy="360" r="4" fill="#00000033" />
  </g>
  <text x="240" y="580" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9CA3AF">${escapeXml(name)}</text>
</svg>`;
}

function shirtBackSvg(id: string, name: string, colorLabel: string, base: string, accent: string, third?: string, fourth?: string): string {
  const patId = `p-${id}-back`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img" aria-label="${escapeXml(name)} — ${escapeXml(colorLabel)}, back view">
  <defs>${checkPatternDefs(patId, base, accent, 28, 12, third, fourth)}</defs>
  <rect width="480" height="600" fill="#F3F4F6" />
  <path d="M150 90 L180 60 L300 60 L330 90 L330 130 L300 150 L300 540 L180 540 L180 150 L150 130 Z" fill="url(#${patId})" stroke="#00000022" stroke-width="2" />
  <path d="M195 130 Q240 150 285 130" fill="none" stroke="#00000022" stroke-width="2" />
  <text x="240" y="580" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9CA3AF">${escapeXml(colorLabel)} — back</text>
</svg>`;
}

function fabricSwatchSvg(id: string, name: string, colorLabel: string, base: string, accent: string, third?: string, fourth?: string): string {
  const patId = `p-${id}-swatch`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img" aria-label="${escapeXml(name)} — ${escapeXml(colorLabel)}, fabric close-up">
  <defs>${checkPatternDefs(patId, base, accent, 60, 10, third, fourth)}</defs>
  <rect width="480" height="600" fill="url(#${patId})" />
  <rect x="16" y="16" width="448" height="568" fill="none" stroke="#FFFFFF55" stroke-width="3" />
</svg>`;
}

function flatLaySvg(id: string, name: string, colorLabel: string, base: string, accent: string, third?: string, fourth?: string): string {
  const patId = `p-${id}-flat`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img" aria-label="${escapeXml(name)} — ${escapeXml(colorLabel)}, flat lay">
  <defs>${checkPatternDefs(patId, base, accent, 24, 6, third, fourth)}</defs>
  <rect width="480" height="600" fill="#EDEEF0" />
  <rect x="90" y="140" width="300" height="360" rx="18" fill="url(#${patId})" stroke="#00000022" stroke-width="2" />
  <line x1="90" y1="320" x2="390" y2="320" stroke="#FFFFFF66" stroke-width="4" />
  <rect x="150" y="100" width="180" height="60" rx="12" fill="${base}" stroke="#00000022" stroke-width="2" />
</svg>`;
}

function collarDetailSvg(id: string, name: string, colorLabel: string, base: string, accent: string, third?: string, fourth?: string): string {
  const patId = `p-${id}-collar`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img" aria-label="${escapeXml(name)} — ${escapeXml(colorLabel)}, collar detail">
  <defs>${checkPatternDefs(patId, base, accent, 36, 8, third, fourth)}</defs>
  <rect width="480" height="600" fill="#F3F4F6" />
  <path d="M120 260 L240 180 L360 260 L360 340 L240 260 L120 340 Z" fill="url(#${patId})" stroke="#00000022" stroke-width="2" />
  <circle cx="180" cy="380" r="6" fill="#00000033" />
  <circle cx="300" cy="380" r="6" fill="#00000033" />
</svg>`;
}

fs.mkdirSync(OUT_ROOT, { recursive: true });

let fileCount = 0;
CURATED_CHECKED_SHIRTS.forEach(({ sku, name, color, base, accent, third, fourth }: CuratedCheckedShirt) => {
  const dir = path.join(OUT_ROOT, sku);
  fs.mkdirSync(dir, { recursive: true });
  const builders = [shirtFrontSvg, shirtBackSvg, fabricSwatchSvg, flatLaySvg, collarDetailSvg];
  builders.forEach((build, idx) => {
    const svg = build(sku, name, color, base, accent, third, fourth);
    fs.writeFileSync(path.join(dir, `${idx + 1}.svg`), svg, 'utf-8');
    fileCount++;
  });
});

console.log(`✔ Generated ${fileCount} placeholder image files for ${CURATED_CHECKED_SHIRTS.length} curated Checked Shirt products → ${path.relative(ROOT, OUT_ROOT)}/CS0XX/1.svg..5.svg`);

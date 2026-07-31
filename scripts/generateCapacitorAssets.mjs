import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'mobile/assets');
mkdirSync(ASSETS_DIR, { recursive: true });

const NAVY = '#131921';
const ORANGE = '#FF9900';

const monogram = (fontSize, fill = '#FFFFFF') => `
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Poppins, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${fill}">
    D<tspan fill="${ORANGE}">M</tspan>
  </text>
`;

async function svgToPng(svg, outPath, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log('wrote', outPath);
}

// Standalone icon — navy rounded square + monogram (matches the existing PWA icon).
await svgToPng(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="192" fill="${NAVY}" />
    ${monogram(360)}
  </svg>`,
  path.join(ASSETS_DIR, 'icon.png'),
  1024,
);

// Adaptive icon background — flat navy, full bleed.
await svgToPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${NAVY}" /></svg>`, path.join(ASSETS_DIR, 'icon-background.png'), 1024);

// Adaptive icon foreground — transparent background, monogram only, kept within Android's safe zone (smaller + centered).
await svgToPng(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${monogram(260)}</svg>`,
  path.join(ASSETS_DIR, 'icon-foreground.png'),
  1024,
);

// Splash screen — navy background + centered monogram.
await svgToPng(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
    <rect width="2732" height="2732" fill="${NAVY}" />
    ${monogram(420)}
  </svg>`,
  path.join(ASSETS_DIR, 'splash.png'),
  2732,
);

console.log('Done.');

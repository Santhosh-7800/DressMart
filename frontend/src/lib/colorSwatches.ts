/**
 * Pure UI-layer color-swatch support for the product filter panel. Nothing here touches
 * filtering itself — facets still return the exact raw `color` value stored on product_variants
 * in Supabase, and that raw value is still what gets sent back as a filter; this module only
 * decides what hex swatch + display name to render for a given raw color label, and which raw
 * values should visually collapse into one swatch (e.g. "Red Variant" / "Red1" both render as
 * a single "Red" swatch, but both underlying values still get toggled together on click).
 */

/** Canonical display name (lowercased) -> hex. Includes every color in the design spec, plus a
 *  few already-generated catalog colors not in that spec (Burgundy, Rust Orange, Teal) so nothing
 *  in the current data ends up unswatched. */
const COLOR_HEX_TABLE: Record<string, string> = {
  white: '#FFFFFF',
  black: '#000000',
  'sky blue': '#87CEEB',
  'baby blue': '#BFEFFF',
  'royal blue': '#4169E1',
  'navy blue': '#1E3A8A',
  'dark blue': '#003366',
  'denim blue': '#1560BD',
  'light blue': '#ADD8E6',
  'powder blue': '#B0E0E6',
  turquoise: '#40E0D0',
  aqua: '#00FFFF',
  teal: '#008080',
  'sea green': '#2E8B57',
  'olive green': '#708238',
  'forest green': '#228B22',
  'bottle green': '#006A4E',
  'dark green': '#006400',
  'sage green': '#9CAF88',
  grey: '#808080',
  'light grey': '#D3D3D3',
  'slate grey': '#708090',
  'steel grey': '#71797E',
  'dark grey': '#4B4B4B',
  'charcoal grey': '#36454F',
  beige: '#F5F5DC',
  khaki: '#C3B091',
  cream: '#FFFDD0',
  'off white': '#FAF9F6',
  mustard: '#E1AD01',
  'mustard yellow': '#D4A017',
  yellow: '#FFD700',
  orange: '#FF8C00',
  'rust orange': '#B7410E',
  coral: '#FF7F50',
  peach: '#FFCBA4',
  'light peach': '#FFDAB9',
  pink: '#FFC0CB',
  lavender: '#E6E6FA',
  lilac: '#C8A2C8',
  purple: '#800080',
  magenta: '#FF00FF',
  wine: '#722F37',
  'wine red': '#8B0000',
  burgundy: '#800020',
  maroon: '#800000',
  'dark maroon': '#4A0404',
  red: '#FF0000',
  brown: '#8B4513',
};

/** US spelling -> UK spelling used as the table's keys (so "Gray"/"Dark Gray" resolve), and
 *  hyphens/underscores treated as spaces (so "Off-White" matches the "off white" table entry). */
function normalizeSpelling(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bgray\b/gi, 'grey')
    .trim();
}

function isKnownColorName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(COLOR_HEX_TABLE, normalizeSpelling(name).toLowerCase());
}

/**
 * Maps a free-text color guess (e.g. from AI image analysis — "navy", "off-white", "denim") onto
 * one of the catalog's actual color values, Title Cased to match how `variant.color` is stored
 * (see catalogSource.ts's COLOR_PALETTE, seeded with exactly these names). This is the single
 * source of truth for "known" catalog colors (COLOR_HEX_TABLE) — visual search reuses it instead
 * of maintaining a second color vocabulary/synonym table.
 *
 * Exact match wins; otherwise the known color name sharing the most words with the input wins
 * (so "dark navy blue shirt" still resolves to "Navy Blue" via the shared "navy"/"blue" words).
 * Falls back to Title Casing the raw input unchanged when nothing matches closely enough — an
 * unrecognized color should still flow through search/display as *something* readable, not be
 * silently dropped.
 */
export function matchToKnownColor(rawGuess: string): string {
  const toTitleCase = (s: string) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const normalized = normalizeSpelling(rawGuess).toLowerCase();
  if (!normalized) return rawGuess;
  if (isKnownColorName(normalized)) return toTitleCase(normalized);

  const guessWords = new Set(normalized.split(' ').filter(Boolean));
  let bestMatch: string | null = null;
  let bestOverlap = 0;
  for (const knownName of Object.keys(COLOR_HEX_TABLE)) {
    const knownWords = knownName.split(' ');
    const overlap = knownWords.filter((w) => guessWords.has(w)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = knownName;
    }
  }
  return bestMatch ? toTitleCase(bestMatch) : toTitleCase(rawGuess);
}

/**
 * Collapses cosmetic variants of the same color into one canonical display name — e.g.
 * "Purple (Variant)" / "Red Variant" / "Red1" / "Navy Blue 2" -> "Purple" / "Red" / "Red" / "Navy Blue".
 * A "Light X" prefix only collapses into "X" when "Light X" isn't itself a distinct named color
 * (so "Light Blue" and "Light Grey" stay as-is, but "Light White" -> "White").
 */
export function canonicalColorName(rawLabel: string): string {
  let name = normalizeSpelling(rawLabel).trim();
  name = name.replace(/\s*\([^)]*\)\s*$/, ''); // trailing "(Variant)"-style qualifier
  name = name.replace(/\s*\d+$/, ''); // trailing number, e.g. "Navy Blue 2", "Red1"
  name = name.replace(/\s+(variant|shade|tone)$/i, ''); // trailing qualifier word
  name = name.trim();

  const strippedLight = name.replace(/^light\s+/i, '').trim();
  if (/^light\s+/i.test(name) && !isKnownColorName(name) && isKnownColorName(strippedLight)) {
    name = strippedLight;
  }

  return name || rawLabel.trim();
}

/** Deterministic fallback hex for a color name we don't recognize, so unknown future values still render something. */
function fallbackHex(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

export function getColorHex(canonicalName: string): string {
  const key = normalizeSpelling(canonicalName).toLowerCase();
  return COLOR_HEX_TABLE[key] ?? fallbackHex(canonicalName);
}

/** Relative luminance so very light swatches (white, cream, off white, ...) get a visible border and a dark checkmark. */
export function isLightColor(hex: string): boolean {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return false;
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(full.slice(1, 3), 16) / 255;
  const g = parseInt(full.slice(3, 5), 16) / 255;
  const b = parseInt(full.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.85;
}

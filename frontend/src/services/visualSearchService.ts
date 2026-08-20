import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { matchToKnownColor } from '@/lib/colorSwatches';
import { findRelatedCategorySlugs } from '@/lib/visualSearchMatch';
import { categoryService } from '@/services/productService';
import type { DetectedClothingAttributes, Gender } from '@/types';

export type { DetectedClothingAttributes } from '@/types';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — the raw upload, before client-side compression below.
const MIN_DIMENSION_PX = 80; // guards against a 1x1 tracking-pixel-style file slipping through.
const COMPRESSED_MAX_EDGE_PX = 1024;
const COMPRESSED_JPEG_QUALITY = 0.85;

export interface ImageValidationError {
  message: string;
}

/** Raw shape the Cloud Function returns — un-normalized, e.g. `primaryColor: "navy"` rather than
 *  the catalog's "Navy Blue". Kept internal to this module; callers only ever see the normalized
 *  DetectedClothingAttributes. */
interface RawClothingAttributes {
  garmentType: string;
  gender: 'men' | 'kids' | 'unisex' | null;
  primaryColor: string;
  secondaryColor: string | null;
  pattern: string | null;
  style: string | null;
  sleeveType: string | null;
  fit: string | null;
  confidence: number;
}

/** File-type/size/dimension checks a user gets immediate, specific feedback on — before spending a
 *  network round-trip (and, once uploaded, an AI API call) on something that was never going to work. */
export function validateImageFile(file: File): ImageValidationError | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { message: 'Please choose a JPG, PNG, or WEBP image.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { message: `That image is too large (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB). Please choose a smaller file.` };
  }
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

/** Downscales to a reasonable max edge and re-encodes as JPEG — keeps the callable payload small
 *  (Firestore/Functions callables cap request size, and a phone photo can be 10+MB) and gives
 *  Gemini a consistent input size, without a visible quality loss for garment classification.
 *  Returns the base64 payload WITHOUT the `data:image/...;base64,` prefix, as the callable expects. */
async function compressToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error('That file doesn’t look like a valid image. Please try a different photo.');
  }
  if (img.naturalWidth < MIN_DIMENSION_PX || img.naturalHeight < MIN_DIMENSION_PX) {
    throw new Error('That image is too small to analyze. Please use a clearer, larger photo.');
  }

  const scale = Math.min(1, COMPRESSED_MAX_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("We couldn't process this image. Please try another photo.");
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', COMPRESSED_JPEG_QUALITY);
  return { base64: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' };
}

/** Maps the AI's raw, un-normalized guesses onto DressMart's actual catalog vocabulary (colors) and
 *  Title Case (garment type) — see matchToKnownColor's docstring for why colors specifically go
 *  through the same table the filter UI already uses, instead of a second color list. */
function normalizeAttributes(raw: RawClothingAttributes): DetectedClothingAttributes {
  const titleCase = (s: string) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return {
    garmentType: titleCase(raw.garmentType),
    gender: raw.gender === 'men' || raw.gender === 'kids' ? raw.gender : null,
    primaryColor: matchToKnownColor(raw.primaryColor),
    secondaryColor: raw.secondaryColor ? matchToKnownColor(raw.secondaryColor) : null,
    pattern: raw.pattern,
    style: raw.style,
    sleeveType: raw.sleeveType,
    fit: raw.fit,
    confidence: raw.confidence,
  };
}

export const visualSearchService = {
  /**
   * Compresses the image client-side, sends it to the analyzeClothingImage Cloud Function (the
   * only place the Gemini API key is used — see backend/functions/README.md), and normalizes the
   * result onto DressMart's own color/category vocabulary. The image itself is never uploaded to
   * Storage or persisted anywhere; it exists only as this one request's payload. Also returns the
   * same compressed image as a `data:` URL — the smallest artifact that can render the "uploaded
   * image" preview on the visual search results page without keeping the (often much larger)
   * original file around or re-reading it from disk a second time.
   */
  async analyzeImage(file: File): Promise<{ attrs: DetectedClothingAttributes; previewDataUrl: string }> {
    const { base64, mimeType } = await compressToBase64(file);
    const call = httpsCallable<{ imageBase64: string; mimeType: string }, RawClothingAttributes>(functions, 'analyzeClothingImage');
    const result = await call({ imageBase64: base64, mimeType });
    return { attrs: normalizeAttributes(result.data), previewDataUrl: `data:${mimeType};base64,${base64}` };
  },

  /** Category slugs to search within for these attributes — every category matching the detected
   *  garment type, for the detected gender (or both genders' categories if the AI couldn't tell). */
  async getRelevantCategorySlugs(attrs: DetectedClothingAttributes): Promise<string[]> {
    const genders: Gender[] = attrs.gender ? [attrs.gender] : ['men', 'kids'];
    const categoryLists = await Promise.all(genders.map((g) => categoryService.list(g)));
    return findRelatedCategorySlugs(attrs.garmentType, categoryLists.flat());
  },

  /** A short, human-readable summary for the results page header, e.g. "Shirt • Black • Solid • Regular Fit". */
  describeAttributes(attrs: DetectedClothingAttributes): string {
    return [attrs.garmentType, attrs.primaryColor, attrs.pattern, attrs.fit].filter(Boolean).join(' • ');
  },

  /** A plain-language search phrase for the existing search-history/recommendation pipeline (see
   *  userActivityService.recordSearch) — deliberately reuses that exact function instead of a
   *  second history/recommendation schema, so a visual search for a "black solid formal shirt"
   *  feeds the same category/brand/color extraction personalizedRecommender.ts already does for
   *  any other search. */
  toSearchPhrase(attrs: DetectedClothingAttributes): string {
    return [attrs.primaryColor, attrs.pattern, attrs.style, attrs.garmentType].filter(Boolean).join(' ');
  },
};

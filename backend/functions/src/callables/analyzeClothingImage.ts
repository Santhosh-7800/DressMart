import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { runCallable } from '../lib/callableGuard';
import { geminiApiKey } from '../lib/config';

/**
 * Visual search's AI step: given a clothing photo, ask Gemini's vision model for the garment's
 * attributes as strict JSON (no DressMart-specific catalog knowledge here — this callable is a
 * thin, reusable "photo -> clothing attributes" boundary; matching those attributes against the
 * actual product catalog, and normalizing color/garment names to DressMart's own vocabulary,
 * happens client-side in visualSearchService.ts, which already owns that catalog knowledge — see
 * that file's docstring for why the split is drawn there instead of duplicating catalog data here).
 */

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Generous cap on the base64 payload itself (~4MB decoded) — the client already downscales/
// compresses before sending (see visualSearchService.ts), so a request this large only happens if
// something bypassed that step; better to reject clearly than let a huge payload hang the request.
const MAX_BASE64_LENGTH = 6_000_000;
const GEMINI_MODEL = 'gemini-2.0-flash';
const REQUEST_TIMEOUT_MS = 25_000;

interface AnalyzeClothingImageData {
  imageBase64: string;
  mimeType: string;
}

/** Exactly what the AI is asked for — deliberately raw/un-normalized (e.g. "navy" instead of "Navy
 *  Blue"); visualSearchService.ts maps these onto DressMart's actual catalog vocabulary. */
export interface RawClothingAttributes {
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

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    garmentType: {
      type: 'STRING',
      description:
        'The single primary clothing item worn/shown in the foreground (ignore background objects, other people, or accessories that are not the main subject), e.g. "Shirt", "T-Shirt", "Polo T-Shirt", "Jeans", "Cargo Pants", "Joggers", "Shorts", "Formal Pants", "Jacket", "Hoodie", "Sweatshirt", "Blazer", "Kurta", "Sherwani", "Belt", "Vest".',
    },
    gender: {
      type: 'STRING',
      enum: ['men', 'kids', 'unisex'],
      description: 'Best guess at who the garment is designed for — an adult (men) or a child (kids).',
    },
    primaryColor: { type: 'STRING', description: 'The dominant color of the garment, in plain English (e.g. "navy blue", "black", "burgundy").' },
    secondaryColor: { type: 'STRING', nullable: true, description: 'A clearly-present second color (e.g. from a print or trim), or null if the garment is a single solid color.' },
    pattern: { type: 'STRING', nullable: true, enum: ['Solid', 'Checked', 'Striped', 'Printed', 'Floral', 'Graphic', 'Textured', 'Denim', 'Other'] },
    style: { type: 'STRING', nullable: true, enum: ['Formal', 'Casual', 'Streetwear', 'Sports', 'Party', 'Traditional', 'Oversized', 'Regular', 'Slim'] },
    sleeveType: { type: 'STRING', nullable: true, description: 'e.g. "Full Sleeve", "Half Sleeve", "Sleeveless" — null if not applicable (e.g. pants).' },
    fit: { type: 'STRING', nullable: true, description: 'e.g. "Slim Fit", "Regular Fit", "Relaxed Fit", "Oversized Fit".' },
    confidence: { type: 'NUMBER', description: 'Your confidence in this analysis overall, from 0 to 1.' },
  },
  required: ['garmentType', 'gender', 'primaryColor', 'confidence'],
};

const PROMPT = `You are a fashion cataloging assistant for an Indian e-commerce clothing store. Look at the photo and identify the ONE primary clothing item being worn, held up, or displayed most prominently — ignore people's faces, backgrounds, furniture, or any other objects that aren't the main garment. If multiple garments are visible, pick the one that fills the most of the frame / is most clearly the subject of the photo.

Respond with ONLY the JSON described by the response schema — no other text.`;

function isValidDataUrlPayload(data: AnalyzeClothingImageData): data is AnalyzeClothingImageData {
  return (
    Boolean(data) &&
    typeof data.imageBase64 === 'string' &&
    data.imageBase64.length > 0 &&
    data.imageBase64.length <= MAX_BASE64_LENGTH &&
    typeof data.mimeType === 'string' &&
    ALLOWED_MIME_TYPES.has(data.mimeType)
  );
}

async function callGemini(imageBase64: string, mimeType: string): Promise<RawClothingAttributes> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey.value()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HttpsError('deadline-exceeded', 'Image analysis is taking too long. Please try again with a clearer photo.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpsError('failed-precondition', 'Visual search is not available right now. Please try text search instead.');
  }
  if (response.status === 429) {
    throw new HttpsError('resource-exhausted', "We're getting a lot of visual search requests right now. Please try again in a moment.");
  }
  if (!response.ok) {
    throw new HttpsError('unavailable', "We couldn't analyze this image. Please try another photo.");
  }

  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new HttpsError('unavailable', "We couldn't analyze this image. Please try another photo.");
  }

  let parsed: Partial<RawClothingAttributes>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpsError('unavailable', "We couldn't analyze this image. Please try another photo.");
  }

  if (!parsed.garmentType || !parsed.primaryColor) {
    throw new HttpsError('unavailable', "We couldn't identify a clothing item in this image. Please try a clearer photo of the garment.");
  }

  return {
    garmentType: parsed.garmentType,
    gender: parsed.gender ?? null,
    primaryColor: parsed.primaryColor,
    secondaryColor: parsed.secondaryColor ?? null,
    pattern: parsed.pattern ?? null,
    style: parsed.style ?? null,
    sleeveType: parsed.sleeveType ?? null,
    fit: parsed.fit ?? null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
  };
}

export const analyzeClothingImage = onCall<AnalyzeClothingImageData>(
  { secrets: [geminiApiKey] },
  async (request): Promise<RawClothingAttributes> =>
    runCallable("We couldn't analyze this image. Please try another photo.", async () => {
      // Deliberately guest-usable, same as DressMart's existing text search — only *recording*
      // visual search history (done client-side in visualSearchService.ts) requires sign-in.
      const data = request.data;
      if (!isValidDataUrlPayload(data)) {
        throw new HttpsError('invalid-argument', 'Please upload a JPG, PNG, or WEBP image under a few megabytes.');
      }
      return callGemini(data.imageBase64, data.mimeType);
    }),
);

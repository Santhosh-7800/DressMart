export type BodyType = 'slim' | 'regular' | 'athletic' | 'broad';

export const BODY_TYPE_OPTIONS: { value: BodyType; label: string }[] = [
  { value: 'slim', label: 'Slim' },
  { value: 'regular', label: 'Regular' },
  { value: 'athletic', label: 'Athletic' },
  { value: 'broad', label: 'Broad' },
];

export type SizeSystem = 'letter' | 'waist' | 'shoe' | 'kids-age' | 'onesize';

export interface SizeProfileInput {
  heightCm: number;
  weightKg: number;
  age: number;
  bodyType: BodyType;
}

export interface SizeRecommendation {
  size: string;
  confidence: number;
  bmi: number | null;
  note: string;
  system: SizeSystem;
  /** Populated when the recommended size has no stock and a nearby size does. */
  alternateSize: string | null;
}

const APPAREL_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** How much a body type shifts the fit up/down the size scale, in "size steps". */
const BODY_TYPE_SHIFT: Record<BodyType, number> = { slim: -0.6, regular: 0, athletic: 0.5, broad: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function classifySizeSystem(sizes: string[]): SizeSystem {
  if (sizes.length === 1 && sizes[0] === 'One Size') return 'onesize';
  if (sizes.every((s) => /^\d+-\d+Y$/.test(s))) return 'kids-age';
  if (sizes.every((s) => /^\d+$/.test(s))) {
    const avg = sizes.reduce((sum, s) => sum + Number(s), 0) / sizes.length;
    return avg >= 20 ? 'waist' : 'shoe';
  }
  return 'letter';
}

function orderSizes(system: SizeSystem, sizes: string[]): string[] {
  if (system === 'letter') return APPAREL_ORDER.filter((s) => sizes.includes(s));
  if (system === 'waist' || system === 'shoe') return [...sizes].sort((a, b) => Number(a) - Number(b));
  if (system === 'kids-age') return [...sizes].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return [...sizes];
}

/** Maps a 0..0.5 distance-from-bucket-center into a confidence percentage within the system's honest range. */
function confidenceFromFraction(frac: number, ceiling: number, floor: number): number {
  const value = ceiling - frac * 2 * (ceiling - floor);
  return Math.round(clamp(value, floor, ceiling));
}

/**
 * Rule-based size recommendation. There's no garment-fitting ML model behind this — it's an
 * honest heuristic (BMI + body type for apparel, height for shoes, age + height for kids' sizes)
 * scoped to whatever sizes are actually orderable for the product/color in question, which is why
 * the confidence is capped well under 100% and varies by how measurement-driven each category is.
 */
export function recommendSize(availableSizes: string[], inputs: SizeProfileInput, stockBySize?: Record<string, number>): SizeRecommendation | null {
  const uniqueSizes = Array.from(new Set(availableSizes));
  if (uniqueSizes.length === 0) return null;

  const system = classifySizeSystem(uniqueSizes);

  if (system === 'onesize') {
    return { size: uniqueSizes[0], confidence: 100, bmi: null, note: 'This item is one-size — no measurements needed.', system, alternateSize: null };
  }

  const ordered = orderSizes(system, uniqueSizes);
  const n = ordered.length;
  const heightM = inputs.heightCm / 100;
  const bmi = inputs.weightKg / (heightM * heightM);

  let continuousIndex: number;
  let note: string;
  let ceiling: number;
  let floor: number;

  if (system === 'letter') {
    const t = clamp((bmi - 17) / (33 - 17), 0, 1);
    continuousIndex = t * (n - 1) + BODY_TYPE_SHIFT[inputs.bodyType];
    if (inputs.age < 18) continuousIndex -= 0.25;
    else if (inputs.age > 55) continuousIndex += 0.2;
    note = `Estimated from a BMI of ${bmi.toFixed(1)} and your ${inputs.bodyType} build. When in stock, cross-check against the size chart for an exact fit.`;
    ceiling = 96;
    floor = 62;
  } else if (system === 'waist') {
    const t = clamp((bmi - 18) / (32 - 18), 0, 1);
    continuousIndex = t * (n - 1) + BODY_TYPE_SHIFT[inputs.bodyType] * 0.7;
    note = `Estimated from a BMI of ${bmi.toFixed(1)}. Waist fit varies by build, so double-check against the size chart if you're between sizes.`;
    ceiling = 90;
    floor = 58;
  } else if (system === 'shoe') {
    const t = clamp((inputs.heightCm - 155) / (195 - 155), 0, 1);
    continuousIndex = t * (n - 1);
    note = 'Foot size correlates loosely with height — treat this as a starting point rather than an exact measurement.';
    ceiling = 74;
    floor = 50;
  } else {
    const bracketIndex = ordered.findIndex((label) => {
      const [lo, hi] = label.replace('Y', '').split('-').map(Number);
      return inputs.age >= lo && inputs.age <= hi;
    });
    continuousIndex = bracketIndex >= 0 ? bracketIndex : clamp(Math.round((inputs.age - 2) / 2), 0, n - 1);
    const expectedHeightForAge = 75 + inputs.age * 6.2;
    const heightDelta = inputs.heightCm - expectedHeightForAge;
    if (heightDelta > 8) continuousIndex += 1;
    else if (heightDelta < -8) continuousIndex -= 1;
    note = `Based on age ${inputs.age}, cross-checked against typical height for that age. Kids grow at different rates, so consider sizing up if in between.`;
    ceiling = 94;
    floor = 65;
  }

  const clampedIndex = clamp(continuousIndex, 0, n - 1);
  const roundedIndex = Math.round(clampedIndex);
  const frac = Math.abs(clampedIndex - roundedIndex);
  const confidence = confidenceFromFraction(frac, ceiling, floor);
  const recommendedSize = ordered[roundedIndex];

  let alternateSize: string | null = null;
  if (stockBySize && (stockBySize[recommendedSize] ?? 0) <= 0) {
    for (let d = 1; d < n; d++) {
      const upIdx = roundedIndex + d;
      const downIdx = roundedIndex - d;
      if (upIdx < n && (stockBySize[ordered[upIdx]] ?? 0) > 0) {
        alternateSize = ordered[upIdx];
        break;
      }
      if (downIdx >= 0 && (stockBySize[ordered[downIdx]] ?? 0) > 0) {
        alternateSize = ordered[downIdx];
        break;
      }
    }
  }

  return { size: recommendedSize, confidence, bmi, note, system, alternateSize };
}

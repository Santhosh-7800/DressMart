import { BRAND_DEFS, COLOR_PALETTE } from '@/data/catalogSource';
import { OCCASIONS } from './outfitRecommender';

export const QUIZ_COLORS = COLOR_PALETTE.filter((c) =>
  ['Black', 'White', 'Navy Blue', 'Charcoal Grey', 'Beige', 'Olive Green', 'Maroon', 'Denim Blue'].includes(c.name),
);

export const QUIZ_FITS = ['Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Oversized Fit'];

export interface QuizBudgetOption {
  key: string;
  label: string;
  min: number;
  max: number;
}

export const QUIZ_BUDGETS: QuizBudgetOption[] = [
  { key: 'budget', label: 'Under ₹1,000', min: 0, max: 999 },
  { key: 'mid', label: '₹1,000 – ₹2,500', min: 1000, max: 2500 },
  { key: 'premium', label: '₹2,500 – ₹5,000', min: 2500, max: 5000 },
  { key: 'luxury', label: 'Above ₹5,000', min: 5000, max: 999999 },
];

export const QUIZ_OCCASIONS = OCCASIONS.map((o) => ({ key: o.key, label: o.label }));

export const QUIZ_BRANDS = BRAND_DEFS.filter((b) => b.focus === 'men' || b.focus === 'both').map((b) => ({ slug: b.slug, name: b.name }));

export const MAX_FAVORITE_BRANDS = 3;

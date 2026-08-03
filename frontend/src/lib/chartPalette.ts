import type { OrderStatus } from '@/types';

/**
 * Single source of truth for every dashboard chart's colors. The brand accent (#FF9900, matching
 * `accent` in tailwind.config.js) is reserved for single-series "hero" charts (a lone revenue trend
 * line) — multi-series breakdowns use this distinct categorical set instead, so a viewer never has
 * to guess whether two different-looking oranges mean the same thing. Chosen to stay legible on
 * both the light (`acc-bg` #F8F9FB) and dark (`surface-dark` #0f1115) dashboard backgrounds without
 * needing separate light/dark variants.
 */
export const CHART_ACCENT = '#FF9900';

export const CHART_CATEGORICAL_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#EF4444', // red
  '#84CC16', // lime
];

/** Status colors are reserved meanings (delivered = green, cancelled = red, ...), never reused as
 *  generic categorical-series colors elsewhere — keeps "red" meaning "cancelled" everywhere it appears. */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  placed: '#F59E0B',
  confirmed: '#3B82F6',
  packed: '#8B5CF6',
  shipped: '#06B6D4',
  out_for_delivery: '#EC4899',
  delivered: '#10B981',
  cancelled: '#EF4444',
  returned: '#DC2626',
};

export const CHART_GRID_COLOR = { light: '#E5E7EB', dark: '#2a2f3a' };
export const CHART_AXIS_COLOR = { light: '#6B7280', dark: '#9CA3AF' };

export function categoricalColor(index: number): string {
  return CHART_CATEGORICAL_COLORS[index % CHART_CATEGORICAL_COLORS.length];
}

import { X } from 'lucide-react';
import type { ProductFacets, ProductFilters } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { canonicalColorName } from '@/lib/colorSwatches';

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFilterChipsProps {
  filters: ProductFilters;
  facets: ProductFacets | undefined;
  onChange: (next: ProductFilters) => void;
}

/**
 * Removable chips summarizing every active filter (Phase 15 Section 26) — each chip clears only
 * its own constraint via onChange, never the whole filter set, so "remove Black" leaves "XL" and
 * "Under ₹1500" in place. Kept as one shared component (not duplicated per page) since
 * SearchResultsPage and ProductListingPage both build the same ProductFilters shape.
 */
export function ActiveFilterChips({ filters, facets, onChange }: ActiveFilterChipsProps) {
  const chips: Chip[] = [];

  (filters.brandIds ?? []).forEach((id) => {
    const label = facets?.brands.find((b) => b.value === id)?.label ?? id;
    chips.push({ key: `brand:${id}`, label, onRemove: () => onChange({ ...filters, brandIds: filters.brandIds!.filter((v) => v !== id), page: 1 }) });
  });

  (filters.colors ?? []).forEach((color) => {
    chips.push({
      key: `color:${color}`,
      label: canonicalColorName(color),
      onRemove: () => onChange({ ...filters, colors: filters.colors!.filter((v) => v !== color), page: 1 }),
    });
  });

  (filters.sizes ?? []).forEach((size) => {
    chips.push({ key: `size:${size}`, label: size, onRemove: () => onChange({ ...filters, sizes: filters.sizes!.filter((v) => v !== size), page: 1 }) });
  });

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const label =
      filters.minPrice !== undefined && filters.maxPrice !== undefined
        ? `${formatCurrency(filters.minPrice)} – ${formatCurrency(filters.maxPrice)}`
        : filters.minPrice !== undefined
          ? `Above ${formatCurrency(filters.minPrice)}`
          : `Under ${formatCurrency(filters.maxPrice!)}`;
    chips.push({ key: 'price', label, onRemove: () => onChange({ ...filters, minPrice: undefined, maxPrice: undefined, page: 1 }) });
  }

  if (filters.minRating !== undefined) {
    chips.push({ key: 'rating', label: `${filters.minRating}★ & above`, onRemove: () => onChange({ ...filters, minRating: undefined, page: 1 }) });
  }

  if (filters.minDiscount !== undefined) {
    chips.push({ key: 'discount', label: `${filters.minDiscount}% or more off`, onRemove: () => onChange({ ...filters, minDiscount: undefined, page: 1 }) });
  }

  if (filters.inStockOnly) {
    chips.push({ key: 'inStock', label: 'In stock only', onRemove: () => onChange({ ...filters, inStockOnly: undefined, page: 1 }) });
  }

  if (chips.length === 0) return null;

  const clearAll = () =>
    onChange({
      gender: filters.gender,
      categorySlugs: filters.categorySlugs,
      search: filters.search,
      visualAttributes: filters.visualAttributes,
      sort: filters.sort,
      page: 1,
      pageSize: filters.pageSize,
    });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={chip.onRemove}
          className="flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"
        >
          {chip.label}
          <X size={12} />
        </button>
      ))}
      <button onClick={clearAll} className="text-xs font-medium text-primary-400 hover:text-accent-600 hover:underline">
        Clear all
      </button>
    </div>
  );
}

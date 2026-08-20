import type { SortOption } from '@/types';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  /** 'popularity' is also the code path productService.list() uses for "relevance" ranking when a
   *  free-text search or visual-search attributes are present (see applySearch/applyVisualSearch) —
   *  same value, contextual label. Defaults to "Popularity" for plain category browsing. */
  popularityLabel?: string;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low_high', label: 'Price: Low to High' },
  { value: 'price_high_low', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'discount', label: 'Biggest Discount' },
];

export function SortDropdown({ value, onChange, popularityLabel }: SortDropdownProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-primary-500 sm:inline">Sort by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm dark:border-primary-600 dark:bg-primary-800"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value === 'popularity' ? (popularityLabel ?? opt.label) : opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

import type { SortOption } from '@/types';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low_high', label: 'Price: Low to High' },
  { value: 'price_high_low', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'discount', label: 'Biggest Discount' },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
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
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

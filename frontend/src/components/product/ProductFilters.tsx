import { useMemo, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { FacetCount, ProductFacets, ProductFilters as Filters } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { canonicalColorName, getColorHex, isLightColor } from '@/lib/colorSwatches';

interface ProductFiltersProps {
  facets: ProductFacets | undefined;
  filters: Filters;
  onChange: (filters: Filters) => void;
}

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-primary-100 py-4 dark:border-primary-700">
      <button onClick={() => setIsOpen((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold">
        {title}
        <ChevronDown size={16} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

const RATING_OPTIONS = [4, 3, 2];
const DISCOUNT_OPTIONS = [10, 25, 40, 50];

interface ColorSwatchGroup {
  displayName: string;
  hex: string;
  /** The exact raw color values (as stored on product_variants in Supabase) this swatch represents — filtering always uses these, never displayName. */
  rawValues: string[];
  count: number;
}

/** Groups raw facet color values by canonical display name, e.g. "Red Variant"/"Red1" both fold into one "Red" swatch. */
function buildColorSwatchGroups(colors: FacetCount[] | undefined): ColorSwatchGroup[] {
  const groups = new Map<string, ColorSwatchGroup>();
  for (const c of colors ?? []) {
    const displayName = canonicalColorName(c.label ?? c.value);
    const key = displayName.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      if (!existing.rawValues.includes(c.value)) existing.rawValues.push(c.value);
      existing.count += c.count;
    } else {
      groups.set(key, { displayName, hex: getColorHex(displayName), rawValues: [c.value], count: c.count });
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export function ProductFilters({ facets, filters, onChange }: ProductFiltersProps) {
  const toggleArrayValue = (key: 'brandIds' | 'sizes', value: string) => {
    const current = (filters[key] ?? []) as string[];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, [key]: next, page: 1 });
  };

  const colorGroups = useMemo(() => buildColorSwatchGroups(facets?.colors), [facets?.colors]);

  const toggleColorGroup = (group: ColorSwatchGroup) => {
    const current = filters.colors ?? [];
    const isSelected = group.rawValues.some((v) => current.includes(v));
    const next = isSelected
      ? current.filter((v) => !group.rawValues.includes(v))
      : [...new Set([...current, ...group.rawValues])];
    onChange({ ...filters, colors: next, page: 1 });
  };

  return (
    <aside className="card-surface h-fit p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <button
          onClick={() => onChange({ gender: filters.gender, categorySlugs: filters.categorySlugs, page: 1, pageSize: filters.pageSize })}
          className="text-xs font-medium text-accent-600 hover:underline"
        >
          Clear all
        </button>
      </div>

      <FilterSection title="Price">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice ?? ''}
            onChange={(e) => onChange({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
            className="input-field !py-1.5 text-xs"
          />
          <span className="text-primary-300">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice ?? ''}
            onChange={(e) => onChange({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined, page: 1 })}
            className="input-field !py-1.5 text-xs"
          />
        </div>
        {facets && (
          <p className="text-xs text-primary-400">
            Range: {formatCurrency(facets.priceRange.min)} – {formatCurrency(facets.priceRange.max)}
          </p>
        )}
      </FilterSection>

      <FilterSection title="Brand">
        <div className="scrollbar-thin max-h-48 space-y-1.5 overflow-y-auto">
          {facets?.brands.map((brand) => (
            <label key={brand.value} className="flex cursor-pointer items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(filters.brandIds ?? []).includes(brand.value)}
                  onChange={() => toggleArrayValue('brandIds', brand.value)}
                  className="h-4 w-4 rounded border-primary-300 text-accent focus:ring-accent"
                />
                {brand.label ?? brand.value}
              </span>
              <span className="text-xs text-primary-300">({brand.count})</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Color">
        <div className="flex flex-wrap gap-3">
          {colorGroups.map((group) => {
            const isSelected = group.rawValues.some((v) => (filters.colors ?? []).includes(v));
            const needsBorder = isLightColor(group.hex);
            return (
              <button
                key={group.displayName}
                onClick={() => toggleColorGroup(group)}
                className="group flex items-center gap-1.5"
                aria-pressed={isSelected}
                title={group.displayName}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-110 group-hover:shadow-md',
                    isSelected ? 'border-2 border-[#FF6B00]' : needsBorder ? 'border border-[#D1D5DB]' : 'border border-black/5',
                  )}
                  style={{ backgroundColor: group.hex }}
                >
                  {isSelected && <Check size={11} strokeWidth={3} className={needsBorder ? 'text-black/70' : 'text-white'} />}
                </span>
                <span className={cn('text-sm font-medium', isSelected ? 'text-accent-700 dark:text-accent-400' : 'text-primary-700 group-hover:text-accent-600 dark:text-primary-200')}>
                  {group.displayName}
                </span>
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title="Size">
        <div className="flex flex-wrap gap-2">
          {facets?.sizes.map((size) => (
            <button
              key={size.value}
              onClick={() => toggleArrayValue('sizes', size.value)}
              className={cn(
                'flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs',
                (filters.sizes ?? []).includes(size.value) ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/30' : 'border-primary-200 dark:border-primary-600',
              )}
            >
              {size.value}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Customer Rating">
        <div className="space-y-1.5">
          {RATING_OPTIONS.map((rating) => (
            <label key={rating} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="rating"
                checked={filters.minRating === rating}
                onChange={() => onChange({ ...filters, minRating: rating, page: 1 })}
                className="h-4 w-4 border-primary-300 text-accent focus:ring-accent"
              />
              {rating}★ &amp; above
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Discount">
        <div className="space-y-1.5">
          {DISCOUNT_OPTIONS.map((discount) => (
            <label key={discount} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="discount"
                checked={filters.minDiscount === discount}
                onChange={() => onChange({ ...filters, minDiscount: discount, page: 1 })}
                className="h-4 w-4 border-primary-300 text-accent focus:ring-accent"
              />
              {discount}% or more
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Availability" defaultOpen={false}>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(filters.inStockOnly)}
            onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked, page: 1 })}
            className="h-4 w-4 rounded border-primary-300 text-accent focus:ring-accent"
          />
          In stock only
        </label>
      </FilterSection>
    </aside>
  );
}

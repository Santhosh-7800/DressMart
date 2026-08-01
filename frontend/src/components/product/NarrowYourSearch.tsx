import { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductFacets, ProductFilters as Filters } from '@/types';
import { ProductImage } from '@/components/ui/ProductImage';
import { cn } from '@/lib/utils';

interface NarrowYourSearchProps {
  facets: ProductFacets | undefined;
  filters: Filters;
  onChange: (filters: Filters) => void;
}

interface Tile {
  key: 'occasions' | 'patterns';
  value: string;
  imageUrl?: string;
}

/**
 * A horizontal row of image tiles for quickly narrowing a listing by occasion ("Casual", "Formal",
 * "Party") or pattern ("Solid", "Printed") — each tile's photo is a real product's own coverImage
 * (see productService.getFacets), never a stock/fabricated image. Deliberately limited to these two
 * dimensions: they're the only ones already modeled on every product (Product.specifications) —
 * fit type and sleeve length aren't tracked yet, so tiles for them would have nothing real to filter.
 */
export function NarrowYourSearch({ facets, filters, onChange }: NarrowYourSearchProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const tiles = useMemo((): Tile[] => {
    const occasionTiles = (facets?.occasions ?? []).map((f): Tile => ({ key: 'occasions', value: f.value, imageUrl: f.sampleImageUrl }));
    const patternTiles = (facets?.patterns ?? []).map((f): Tile => ({ key: 'patterns', value: f.value, imageUrl: f.sampleImageUrl }));
    return [...occasionTiles, ...patternTiles];
  }, [facets]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  const toggleTile = (tile: Tile) => {
    const current = filters[tile.key] ?? [];
    const next = current.includes(tile.value) ? current.filter((v) => v !== tile.value) : [...current, tile.value];
    onChange({ ...filters, [tile.key]: next, page: 1 });
  };

  if (tiles.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-primary-900 dark:text-white">Narrow your search</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => scroll('left')} className="hidden h-8 w-8 items-center justify-center rounded-full border border-primary-200 sm:flex dark:border-primary-600" aria-label="Scroll left">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scroll('right')} className="hidden h-8 w-8 items-center justify-center rounded-full border border-primary-200 sm:flex dark:border-primary-600" aria-label="Scroll right">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
        {tiles.map((tile) => {
          const isSelected = (filters[tile.key] ?? []).includes(tile.value);
          return (
            <button
              key={`${tile.key}-${tile.value}`}
              onClick={() => toggleTile(tile)}
              aria-pressed={isSelected}
              className={cn(
                'w-20 shrink-0 rounded-xl border p-1.5 text-center transition-colors sm:w-24',
                isSelected ? 'border-accent bg-accent-50 dark:bg-accent-900/20' : 'border-primary-100 hover:border-primary-300 dark:border-primary-700 dark:hover:border-primary-500',
              )}
            >
              <ProductImage src={tile.imageUrl} alt={tile.value} className="aspect-square rounded-lg" />
              <p className={cn('mt-1.5 truncate text-xs font-medium', isSelected ? 'text-accent-700 dark:text-accent-400' : 'text-primary-700 dark:text-primary-200')}>{tile.value}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

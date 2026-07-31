import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SizeChartModal } from './SizeChartModal';

interface SizeOption {
  size: string;
  inStock: boolean;
  /** Present once inventory has resolved — used to surface "Only N left" for low-stock sizes. */
  stockCount?: number;
  isLowStock?: boolean;
}

interface SizeSelectorProps {
  sizes: SizeOption[];
  activeSize: string | null;
  onChange: (size: string) => void;
  gender?: 'men' | 'kids' | string;
}

export function SizeSelector({ sizes, activeSize, onChange, gender = 'men' }: SizeSelectorProps) {
  const [isChartOpen, setIsChartOpen] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Size</p>
        <button
          type="button"
          onClick={() => setIsChartOpen(true)}
          className="text-xs text-accent-600 hover:underline focus:outline-none"
        >
          Size chart
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map(({ size, inStock, stockCount, isLowStock }) => (
          <div key={size} className="relative">
            <button
              disabled={!inStock}
              onClick={() => onChange(size)}
              title={!inStock ? `${size} — Out of stock` : isLowStock ? `${size} — Only ${stockCount} left` : size}
              aria-label={!inStock ? `${size}, out of stock` : size}
              className={cn(
                'flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors',
                !inStock && 'cursor-not-allowed border-primary-100 text-primary-300 line-through dark:border-primary-700 dark:text-primary-600',
                inStock && activeSize === size && 'border-primary bg-primary text-white',
                inStock && activeSize !== size && 'border-primary-200 hover:border-primary-900 dark:border-primary-600 dark:hover:border-white',
              )}
            >
              {size}
            </button>
            {!inStock && (
              <span className="pointer-events-none absolute -right-1.5 -top-1.5 rounded-full bg-primary-400 px-1 text-[9px] font-bold uppercase leading-tight text-white dark:bg-primary-600">
                Out
              </span>
            )}
            {inStock && isLowStock && (
              <span className="pointer-events-none absolute -right-1.5 -top-1.5 whitespace-nowrap rounded-full bg-red-500 px-1 text-[9px] font-bold uppercase leading-tight text-white">
                {stockCount} left
              </span>
            )}
          </div>
        ))}
      </div>

      <SizeChartModal isOpen={isChartOpen} onClose={() => setIsChartOpen(false)} gender={gender} />
    </div>
  );
}

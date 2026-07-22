import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SizeOption {
  size: string;
  inStock: boolean;
}

interface SizeSelectorProps {
  sizes: SizeOption[];
  activeSize: string | null;
  onChange: (size: string) => void;
}

export function SizeSelector({ sizes, activeSize, onChange }: SizeSelectorProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Size</p>
        <Link to="/help-center" className="text-xs text-accent-600 hover:underline">
          Size chart
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map(({ size, inStock }) => (
          <button
            key={size}
            disabled={!inStock}
            onClick={() => onChange(size)}
            className={cn(
              'flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors',
              !inStock && 'cursor-not-allowed border-primary-100 text-primary-300 line-through dark:border-primary-700 dark:text-primary-600',
              inStock && activeSize === size && 'border-primary bg-primary text-white',
              inStock && activeSize !== size && 'border-primary-200 hover:border-primary-900 dark:border-primary-600 dark:hover:border-white',
            )}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}

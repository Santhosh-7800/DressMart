import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PriceTagProps {
  price: number;
  mrp?: number;
  discountPercent?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: { price: 'text-sm', mrp: 'text-xs' },
  md: { price: 'text-base', mrp: 'text-sm' },
  lg: { price: 'text-2xl', mrp: 'text-base' },
};

export function PriceTag({ price, mrp, discountPercent, size = 'md', className }: PriceTagProps) {
  const showMrp = mrp && mrp > price;
  return (
    <div className={cn('flex flex-wrap items-baseline gap-2', className)}>
      <span className={cn('font-bold text-primary-900 dark:text-white', sizeClasses[size].price)}>{formatCurrency(price)}</span>
      {showMrp && <span className={cn('text-primary-300 line-through dark:text-primary-500', sizeClasses[size].mrp)}>{formatCurrency(mrp)}</span>}
      {Boolean(discountPercent) && <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{discountPercent}% off</span>}
    </div>
  );
}

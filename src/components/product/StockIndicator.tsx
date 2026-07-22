import { cn } from '@/lib/utils';

interface StockIndicatorProps {
  claimed: number;
  total: number;
  className?: string;
}

export function StockIndicator({ claimed, total, className }: StockIndicatorProps) {
  if (total <= 0) return null;

  const remaining = Math.max(0, total - claimed);
  const percentClaimed = Math.min(100, Math.round((claimed / total) * 100));
  const isSoldOut = remaining <= 0;
  const isLow = !isSoldOut && remaining <= Math.max(3, Math.round(total * 0.15));

  return (
    <div className={cn('space-y-1', className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-100 dark:bg-primary-700">
        <div
          className={cn('h-full rounded-full transition-all', isSoldOut ? 'bg-primary-300 dark:bg-primary-600' : isLow ? 'bg-red-500' : 'bg-accent')}
          style={{ width: `${percentClaimed}%` }}
        />
      </div>
      <p className={cn('text-xs font-medium', isSoldOut ? 'text-primary-400' : isLow ? 'text-red-500' : 'text-primary-500 dark:text-primary-300')}>
        {isSoldOut ? 'Sold out' : `Only ${remaining} left · ${percentClaimed}% claimed`}
      </p>
    </div>
  );
}

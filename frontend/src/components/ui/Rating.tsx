import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
  /** Shown instead of the star badge when count is exactly 0 — no product ever shows stars with zero reviews. */
  emptyLabel?: string;
}

export function Rating({ value, count, size = 14, showValue = false, className, emptyLabel = 'No reviews yet' }: RatingProps) {
  if (count === 0) {
    return <span className={cn('text-xs font-medium text-primary-400 dark:text-primary-300', className)}>{emptyLabel}</span>;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-white">
        <span className="text-xs font-semibold">{value.toFixed(1)}</span>
        <Star size={size - 3} fill="white" className="shrink-0" />
      </div>
      {showValue && count !== undefined && (
        <span className="text-xs text-primary-400 dark:text-primary-300">({count.toLocaleString('en-IN')})</span>
      )}
    </div>
  );
}

export function StarRatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)} aria-label={`Rate ${star} stars`}>
          <Star size={28} className={cn(star <= value ? 'fill-accent text-accent' : 'text-primary-200 dark:text-primary-600')} />
        </button>
      ))}
    </div>
  );
}

import { Check, Scale } from 'lucide-react';
import { useCompare } from '@/hooks/useCompare';
import { cn } from '@/lib/utils';

interface CompareToggleProps {
  productId: string;
  className?: string;
}

export function CompareToggle({ productId, className }: CompareToggleProps) {
  const { isComparing, toggleCompare } = useCompare();
  const active = isComparing(productId);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        toggleCompare(productId);
      }}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300'
          : 'border-primary-200 text-primary-500 hover:border-primary-300 dark:border-primary-600 dark:text-primary-300 dark:hover:border-primary-500',
        className,
      )}
    >
      {active ? <Check size={12} /> : <Scale size={12} />}
      {active ? 'Comparing' : 'Compare'}
    </button>
  );
}

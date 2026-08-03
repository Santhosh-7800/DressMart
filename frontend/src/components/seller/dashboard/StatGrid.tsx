import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatCard, StatCardSkeleton, type StatCardConfig } from './StatCard';

interface StatGridProps {
  title: string;
  cards: StatCardConfig[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  skeletonCount?: number;
  columnsClassName?: string;
}

/** Generic animated stat-tile grid — every dashboard section (Your Store, Platform Overview,
 *  Orders, Payments, ...) renders through this instead of hand-rolling its own grid + loading/error
 *  states each time. */
export function StatGrid({ title, cards, isLoading, isError, skeletonCount = 6, columnsClassName = 'md:grid-cols-3 lg:grid-cols-4' }: StatGridProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">{title}</h2>
      <div className={`grid grid-cols-2 gap-4 ${columnsClassName}`}>
        {isLoading ? (
          Array.from({ length: skeletonCount }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : isError || !cards ? (
          <Card hover={false} className="col-span-full flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle size={16} /> Couldn't load these stats. Try refreshing.
          </Card>
        ) : (
          cards.map(({ key, ...card }) => <StatCard key={key} {...card} />)
        )}
      </div>
    </section>
  );
}

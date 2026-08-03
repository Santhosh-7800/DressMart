import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

interface ChartCardProps {
  title: string;
  icon: LucideIcon;
  isLoading: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
  children: ReactNode;
}

/** Shared title/loading/empty-state wrapper every analytics chart renders inside — keeps each
 *  individual chart component focused on just its recharts markup. */
export function ChartCard({ title, icon: Icon, isLoading, isEmpty, emptyLabel = 'Not enough data yet.', children }: ChartCardProps) {
  return (
    <Card hover={false} className="flex flex-col">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-acc-text dark:text-white">
        <Icon size={16} className="text-acc-primary" /> {title}
      </h3>
      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : isEmpty ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-xs text-acc-text-secondary">
          <AlertTriangle size={20} className="text-primary-300" />
          {emptyLabel}
        </div>
      ) : (
        <div className="h-56 w-full">{children}</div>
      )}
    </Card>
  );
}

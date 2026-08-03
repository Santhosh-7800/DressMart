import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';

export type StatTone = 'default' | 'warning' | 'success' | 'danger';

const TONE_ICON_CLASSES: Record<StatTone, string> = {
  default: 'bg-acc-primary/10 text-acc-primary',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  success: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  danger: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

export interface StatCardConfig {
  key: string;
  icon: LucideIcon;
  label: string;
  value: number;
  to?: string;
  tone?: StatTone;
  formatter?: (n: number) => string;
}

export function StatCard({ icon: Icon, label, value, to, tone = 'default', formatter }: Omit<StatCardConfig, 'key'>) {
  const content = (
    <Card hover={Boolean(to)} className="flex items-center gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON_CLASSES[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-acc-text dark:text-white">
          <AnimatedCounter value={value} formatter={formatter} />
        </p>
        <p className="text-xs leading-tight text-acc-text-secondary">{label}</p>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function StatCardSkeleton() {
  return (
    <Card hover={false} className="flex items-center gap-4">
      <Skeleton className="h-11 w-11 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </Card>
  );
}

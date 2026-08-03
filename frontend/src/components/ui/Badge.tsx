import { cn } from '@/lib/utils';

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-primary-100 text-primary-600 dark:bg-primary-800 dark:text-primary-300',
  success: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}

/** Small status pill — same visual convention already hand-rolled per-page (e.g. SellerSellersPage's
 *  StatusBadge) productized into one shared component for new dashboard sections. */
export function Badge({ tone = 'default', children, className }: BadgeProps) {
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold capitalize', TONE_CLASSES[tone], className)}>{children}</span>;
}

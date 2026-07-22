import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface DashboardSectionProps {
  title: string;
  icon?: LucideIcon;
  viewAllHref?: string;
  children: ReactNode;
  className?: string;
}

/** Shared "icon + title + optional View all link" header wrapped around a Card, used by every dashboard widget. */
export function DashboardSection({ title, icon: Icon, viewAllHref, children, className }: DashboardSectionProps) {
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-acc-primary/10 text-acc-primary">
              <Icon size={16} />
            </span>
          )}
          <h2 className="text-base font-bold text-acc-text dark:text-white sm:text-lg">{title}</h2>
        </div>
        {viewAllHref && (
          <Link to={viewAllHref} className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-acc-primary transition-colors hover:text-acc-secondary">
            View all <ChevronRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

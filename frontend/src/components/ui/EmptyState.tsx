import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-card px-6 py-16 text-center dark:bg-card-dark">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-800">
        <Icon size={28} className="text-primary-400" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-primary-400 dark:text-primary-300">{description}</p>}
      {actionLabel && actionHref && (
        <Link to={actionHref} className="btn-accent mt-6">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

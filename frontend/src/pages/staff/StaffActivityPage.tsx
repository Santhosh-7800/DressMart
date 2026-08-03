import { Clock } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useOwnStaffActivity } from '@/hooks/useStaff';
import { ACTIVITY_ICON, ACTIVITY_LABEL } from '@/lib/staffActivity';
import { formatDateTime } from '@/lib/utils';

/** Full history of this staff account's own actions (adding/editing products, updating stock,
 *  logins) — the Dashboard only shows a short preview of this same data. */
export function StaffActivityPage() {
  const { data: activity, isLoading } = useOwnStaffActivity(100);

  return (
    <div>
      <Seo title="My Activity" />
      <h1 className="mb-1 text-2xl font-bold text-acc-text dark:text-white">My Activity</h1>
      <p className="mb-6 text-sm text-acc-text-secondary">Everything you've done on this account, most recent first.</p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !activity || activity.length === 0 ? (
        <EmptyState icon={Clock} title="No activity yet" description="Actions you take (adding, editing products, updating stock) show up here." />
      ) : (
        <div className="relative space-y-4 pl-6">
          <div className="absolute bottom-2 left-[11px] top-2 w-px bg-acc-border dark:bg-primary-700" />
          {activity.map((entry) => {
            const Icon = ACTIVITY_ICON[entry.action];
            return (
              <div key={entry.id} className="relative">
                <div className="absolute -left-6 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-acc-primary text-white ring-4 ring-acc-bg dark:ring-surface-dark">
                  <Icon size={12} />
                </div>
                <Card hover={false} className="p-4">
                  <p className="text-sm font-medium text-acc-text dark:text-white">
                    {ACTIVITY_LABEL[entry.action]}
                    {entry.target_label && <span className="font-normal text-acc-text-secondary"> · {entry.target_label}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-acc-text-secondary">{formatDateTime(entry.created_at)}</p>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

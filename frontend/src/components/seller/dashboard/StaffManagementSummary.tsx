import { useQuery } from '@tanstack/react-query';
import { UserCheck, UserX, Users } from 'lucide-react';
import { staffAdminService } from '@/services/staffAdminService';
import { queryKeys } from '@/lib/queryClient';
import { StatGrid } from './StatGrid';
import type { StatCardConfig } from './StatCard';

/** Head-Seller-only summary of the staff roster — counts only; Add/Edit/Permissions/Remove actions
 *  stay on the full SellerStaffPage this links to. */
export function StaffManagementSummary({ sellerId }: { sellerId: string }) {
  const staffQuery = useQuery({
    queryKey: queryKeys.staff.roster(sellerId),
    queryFn: () => staffAdminService.listStaff(sellerId),
    enabled: Boolean(sellerId),
  });

  const cards: StatCardConfig[] | undefined = staffQuery.data
    ? [
        { key: 'total', icon: Users, label: 'Staff Members', value: staffQuery.data.length, to: '/seller/staff' },
        {
          key: 'active',
          icon: UserCheck,
          label: 'Active Staff',
          value: staffQuery.data.filter((s) => s.staff_status === 'active').length,
          to: '/seller/staff',
          tone: 'success',
        },
        {
          key: 'disabled',
          icon: UserX,
          label: 'Disabled Staff',
          value: staffQuery.data.filter((s) => s.staff_status === 'disabled').length,
          to: '/seller/staff',
          tone: 'warning',
        },
      ]
    : undefined;

  return <StatGrid title="Staff Management" cards={cards} isLoading={staffQuery.isLoading} isError={staffQuery.isError} skeletonCount={3} columnsClassName="md:grid-cols-3" />;
}

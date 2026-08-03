import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { sellerAdminService } from '@/services/sellerAdminService';
import { queryKeys } from '@/lib/queryClient';
import { StatGrid } from './StatGrid';
import type { StatCardConfig } from './StatCard';

/** Head-Seller-only summary of the seller roster — counts only; Approve/Reject/Suspend/Reactivate
 *  actions themselves stay on the full SellerSellersPage this links to, not duplicated here. */
export function SellerManagementSummary() {
  const sellersQuery = useQuery({ queryKey: queryKeys.seller.sellers, queryFn: () => sellerAdminService.listSellers() });
  const requestsQuery = useQuery({ queryKey: queryKeys.sellerRequests.all, queryFn: () => sellerAdminService.listSellerRequests() });

  const isLoading = sellersQuery.isLoading || requestsQuery.isLoading;
  const isError = sellersQuery.isError || requestsQuery.isError;

  const cards: StatCardConfig[] | undefined =
    sellersQuery.data && requestsQuery.data
      ? [
          {
            key: 'pending',
            icon: Clock,
            label: 'Pending Sellers',
            value: sellersQuery.data.filter((s) => s.seller_status === 'pending').length,
            to: '/seller/sellers',
            tone: 'warning',
          },
          {
            key: 'approved',
            icon: CheckCircle2,
            label: 'Approved Sellers',
            value: sellersQuery.data.filter((s) => s.seller_status === 'approved').length,
            to: '/seller/sellers',
            tone: 'success',
          },
          {
            key: 'rejected',
            icon: XCircle,
            label: 'Rejected Sellers',
            value: requestsQuery.data.filter((r) => r.status === 'rejected').length,
            to: '/seller/sellers',
            tone: 'danger',
          },
          {
            key: 'suspended',
            icon: Ban,
            label: 'Suspended Sellers',
            value: sellersQuery.data.filter((s) => s.seller_status === 'suspended').length,
            to: '/seller/sellers',
            tone: 'danger',
          },
        ]
      : undefined;

  return <StatGrid title="Seller Management" cards={cards} isLoading={isLoading} isError={isError} skeletonCount={4} columnsClassName="md:grid-cols-4" />;
}

import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { queryKeys } from '@/lib/queryClient';
import { sellerAdminService } from '@/services/sellerAdminService';
import { formatDate } from '@/lib/utils';

/** Read-only customer (buyer) directory — Head-Seller-only, see RequireHeadSeller. */
export function SellerCustomersPage() {
  const customersQuery = useQuery({
    queryKey: queryKeys.seller.customers,
    queryFn: () => sellerAdminService.listCustomers(),
  });

  const customers = customersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Seo title="Customers" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Customers</h1>
        <p className="text-sm text-acc-text-secondary">{customers.length} total</p>
      </div>

      {customersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" description="Customer accounts will show up here once buyers sign up." />
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => (
            <Card key={customer.id} hover={false} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-acc-text dark:text-white">{customer.full_name}</p>
                <p className="text-sm text-acc-text-secondary">
                  {customer.email}
                  {customer.phone ? ` · ${customer.phone}` : ''}
                </p>
              </div>
              <p className="shrink-0 text-xs text-acc-text-secondary">Joined {formatDate(customer.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

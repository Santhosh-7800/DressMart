import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Gift, Heart, Package, Ticket, Wallet } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Skeleton } from '@/components/ui/Skeleton';
import { adminDataService } from '@/services/adminDataService';
import { orderService } from '@/services/orderService';
import { wishlistService } from '@/services/wishlistService';
import { rewardsService } from '@/services/rewardsService';
import { couponService } from '@/services/couponService';
import { formatCurrency, formatDate } from '@/lib/utils';

export function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customerId = id as string;

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({ queryKey: ['admin', 'customers'], queryFn: () => adminDataService.getAllProfiles() });
  const { data: orders, isLoading: isLoadingOrders } = useQuery({ queryKey: ['admin', 'customer-orders', customerId], queryFn: () => orderService.list(customerId) });
  const { data: wishlist, isLoading: isLoadingWishlist } = useQuery({ queryKey: ['admin', 'customer-wishlist', customerId], queryFn: () => wishlistService.list(customerId) });
  const { data: wallet, isLoading: isLoadingWallet } = useQuery({ queryKey: ['admin', 'customer-wallet', customerId], queryFn: () => rewardsService.getWallet(customerId) });
  const { data: coupons, isLoading: isLoadingCoupons } = useQuery({
    queryKey: ['admin', 'customer-coupons', customerId],
    queryFn: () => couponService.list(customerId).then((all) => all.filter((c) => c.granted_to_user_id === customerId)),
  });

  const customer = profiles?.find((p) => p.id === customerId);
  const isLoading = isLoadingProfiles || isLoadingOrders || isLoadingWishlist || isLoadingWallet || isLoadingCoupons;

  if (isLoading || !customer) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div>
      <Seo title={`Admin — ${customer.full_name}`} />
      <Link to="/admin/customers" className="mb-4 flex items-center gap-1.5 text-sm font-medium text-admin-text-secondary hover:text-admin-orange">
        <ArrowLeft size={15} /> Back to Customers
      </Link>

      <div className="card-surface mb-6 flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-admin-orange-light to-admin-orange text-xl font-bold text-white shadow-sm">
          {customer.full_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-admin-text">{customer.full_name}</h1>
          <p className="text-sm text-admin-text-secondary">
            {customer.email} · {customer.phone ?? 'No phone'} · Joined {formatDate(customer.created_at)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card-surface p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-admin-text-secondary">
            <Package size={13} className="text-admin-orange" /> Orders
          </p>
          <p className="mt-1 text-2xl font-bold text-admin-text">{orders?.length ?? 0}</p>
        </div>
        <div className="card-surface p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-admin-text-secondary">
            <Heart size={13} className="text-admin-orange" /> Wishlist
          </p>
          <p className="mt-1 text-2xl font-bold text-admin-text">{wishlist?.length ?? 0}</p>
        </div>
        <div className="card-surface p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-admin-text-secondary">
            <Wallet size={13} className="text-admin-orange" /> Reward Points
          </p>
          <p className="mt-1 text-2xl font-bold text-admin-text">{(wallet?.points_balance ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="card-surface p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-admin-text-secondary">
            <Ticket size={13} className="text-admin-orange" /> Coupons
          </p>
          <p className="mt-1 text-2xl font-bold text-admin-text">{(coupons ?? []).length}</p>
        </div>
      </div>

      <div className="card-surface mb-6 p-5">
        <h2 className="mb-3 font-semibold">Orders</h2>
        <div className="space-y-2">
          {(orders ?? []).slice(0, 10).map((order) => (
            <div key={order.id} className="flex items-center justify-between border-b border-admin-row-border py-2 text-sm last:border-0">
              <span className="text-admin-text-secondary">
                #{order.order_number} · {formatDate(order.placed_at)}
              </span>
              <span className="font-medium text-admin-text">{formatCurrency(order.total)}</span>
            </div>
          ))}
          {(orders ?? []).length === 0 && <p className="py-4 text-center text-sm text-admin-text-secondary">No orders yet.</p>}
        </div>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-semibold">
          <Gift size={16} className="text-admin-orange" /> Wishlist
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(wishlist ?? []).slice(0, 8).map((item) => (
            <div key={item.id} className="text-xs text-admin-text-secondary">
              {item.product?.name ?? item.product_id}
            </div>
          ))}
          {(wishlist ?? []).length === 0 && <p className="col-span-full py-2 text-center text-sm text-admin-text-secondary">No wishlisted items.</p>}
        </div>
      </div>
    </div>
  );
}

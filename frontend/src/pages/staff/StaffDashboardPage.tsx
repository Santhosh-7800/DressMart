import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, PackagePlus, ShoppingBag, AlertTriangle, Plus, Clock, LogIn, PencilLine, Trash2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerProducts } from '@/hooks/useSellerProducts';
import { useSellerOrders } from '@/hooks/useOrders';
import { useStaffPermissions, useOwnStaffActivity } from '@/hooks/useStaff';
import { inventoryService } from '@/services/inventoryService';
import { formatDateTime } from '@/lib/utils';
import type { StaffActivityAction } from '@/types';

const ACTIVE_ORDER_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery'];

const ACTIVITY_ICON: Record<StaffActivityAction, typeof LogIn> = {
  login: LogIn,
  product_created: PackagePlus,
  product_updated: PencilLine,
  product_deleted: Trash2,
};

const ACTIVITY_LABEL: Record<StaffActivityAction, string> = {
  login: 'Logged in',
  product_created: 'Added',
  product_updated: 'Updated',
  product_deleted: 'Deleted',
};

function StatCard({ icon: Icon, label, value, to }: { icon: typeof Package; label: string; value: number | string; to?: string }) {
  const content = (
    <Card hover={Boolean(to)} className="flex items-center gap-3 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-acc-text dark:text-white">{value}</p>
        <p className="truncate text-xs text-acc-text-secondary">{label}</p>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function StaffDashboardPage() {
  const { user } = useAuth();
  const { data: permissions } = useStaffPermissions();
  const { data: products = [], isLoading: isLoadingProducts } = useSellerProducts();
  const { data: orders = [], isLoading: isLoadingOrders } = useSellerOrders();
  const { data: activity, isLoading: isLoadingActivity } = useOwnStaffActivity();

  const myProducts = useMemo(() => products.filter((p) => p.staff_id === user?.id), [products, user?.id]);
  const todayCount = useMemo(() => {
    const todayKey = new Date().toDateString();
    return myProducts.filter((p) => new Date(p.created_at).toDateString() === todayKey).length;
  }, [myProducts]);
  const pendingOrders = useMemo(() => orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)), [orders]);

  const { data: inventoryMap = {}, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['seller', 'inventory', 'batch', products.map((p) => p.id)],
    queryFn: () => inventoryService.getInventoryBatch(products.map((p) => p.id)),
    enabled: Boolean(permissions?.manage_inventory) && products.length > 0,
  });
  const lowStockCount = useMemo(
    () => products.filter((p) => {
      const inv = inventoryMap[p.id];
      return inv && inv.total_stock <= inv.low_stock_threshold;
    }).length,
    [products, inventoryMap],
  );

  const canAddProducts = Boolean(permissions?.add_products);
  const canSeeOrders = Boolean(permissions?.process_orders || permissions?.update_order_status);
  const canSeeInventory = Boolean(permissions?.manage_inventory);

  return (
    <div>
      <Seo title="Staff Dashboard" />
      <h1 className="mb-1 text-2xl font-bold">Welcome, {user?.full_name?.split(' ')[0]}</h1>
      <p className="mb-6 text-sm text-primary-400">{user?.store_name ? `Working for ${user.store_name}` : 'Your staff dashboard'}</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoadingProducts ? (
          <Skeleton className="h-[74px] w-full sm:col-span-2" />
        ) : (
          <>
            <StatCard icon={Package} label="Products Added by You" value={myProducts.length} to="/staff/products" />
            <StatCard icon={PackagePlus} label="Added Today" value={todayCount} to="/staff/products" />
          </>
        )}
        {canSeeOrders && (
          <StatCard icon={ShoppingBag} label="Pending Orders" value={isLoadingOrders ? '—' : pendingOrders.length} to="/staff/orders" />
        )}
        {canSeeInventory && (
          <StatCard icon={AlertTriangle} label="Low Stock Alerts" value={isLoadingInventory ? '—' : lowStockCount} to="/staff/inventory" />
        )}
      </div>

      {canAddProducts && (
        <Link to="/staff/products/new" className="btn-accent mb-6 inline-flex text-sm">
          <Plus size={15} /> Quick Add Product
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Recent Activity</h2>
        {isLoadingActivity ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !activity || activity.length === 0 ? (
          <EmptyState icon={Clock} title="No activity yet" description="Actions you take (adding, editing, deleting products) show up here." />
        ) : (
          <div className="space-y-2">
            {activity.map((entry) => {
              const Icon = ACTIVITY_ICON[entry.action];
              return (
                <Card key={entry.id} hover={false} className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500 dark:bg-primary-800">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{ACTIVITY_LABEL[entry.action]}</span>
                      {entry.target_label && <span className="text-primary-500"> · {entry.target_label}</span>}
                    </p>
                    <p className="text-xs text-primary-400">{formatDateTime(entry.created_at)}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, PackagePlus, FileEdit, PackageX, Plus, FileUp, ImagePlus, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductImage } from '@/components/ui/ProductImage';
import { ImportProductsModal } from '@/components/staff/ImportProductsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerProducts } from '@/hooks/useSellerProducts';
import { useStaffPermissions, useOwnStaffActivity } from '@/hooks/useStaff';
import { inventoryService } from '@/services/inventoryService';
import { ACTIVITY_ICON, ACTIVITY_LABEL } from '@/lib/staffActivity';
import { formatDateTime, formatCurrency } from '@/lib/utils';

function StatCard({ icon: Icon, label, value, to, tone = 'default' }: { icon: typeof Package; label: string; value: number | string; to?: string; tone?: 'default' | 'warning' }) {
  const content = (
    <Card hover={Boolean(to)} className="flex items-center gap-3 p-4">
      <div
        className={
          tone === 'warning'
            ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
            : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary'
        }
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-acc-text dark:text-white">{value}</p>
        <p className="text-xs leading-tight text-acc-text-secondary">{label}</p>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function StaffDashboardPage() {
  const { user } = useAuth();
  const { data: permissions } = useStaffPermissions();
  const { data: products = [], isLoading: isLoadingProducts } = useSellerProducts();
  const { data: activity, isLoading: isLoadingActivity } = useOwnStaffActivity(8);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const myProducts = useMemo(
    () => [...products.filter((p) => p.staff_id === user?.id)].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [products, user?.id],
  );
  const todayCount = useMemo(() => {
    const todayKey = new Date().toDateString();
    return myProducts.filter((p) => new Date(p.created_at).toDateString() === todayKey).length;
  }, [myProducts]);
  const draftCount = useMemo(() => myProducts.filter((p) => p.status === 'draft').length, [myProducts]);
  const outOfStockCount = useMemo(() => myProducts.filter((p) => p.status === 'out_of_stock').length, [myProducts]);
  const recentlyAdded = myProducts.slice(0, 5);

  const canSeeInventory = Boolean(permissions?.manage_inventory);
  const { data: inventoryMap = {}, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['seller', 'inventory', 'batch', myProducts.map((p) => p.id)],
    queryFn: () => inventoryService.getInventoryBatch(myProducts.map((p) => p.id)),
    enabled: canSeeInventory && myProducts.length > 0,
  });
  const alertProducts = useMemo(
    () =>
      myProducts
        .map((p) => ({ product: p, inventory: inventoryMap[p.id] }))
        .filter(({ inventory }) => inventory && inventory.total_stock <= inventory.low_stock_threshold)
        .slice(0, 5),
    [myProducts, inventoryMap],
  );

  const canAddProducts = Boolean(permissions?.add_products);

  return (
    <div>
      <Seo title="Staff Dashboard" />
      <h1 className="mb-1 text-2xl font-bold text-acc-text dark:text-white">Welcome, {user?.full_name?.split(' ')[0]}</h1>
      <p className="mb-6 text-sm text-acc-text-secondary">{user?.store_name ? `Working for ${user.store_name}` : 'Your staff dashboard'}</p>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoadingProducts ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[74px] w-full" />)
          ) : (
            <>
              <StatCard icon={PackagePlus} label="Products Added Today" value={todayCount} to="/staff/products" />
              <StatCard icon={Package} label="Total Products Added" value={myProducts.length} to="/staff/products" />
              <StatCard icon={FileEdit} label="Draft Products" value={draftCount} to="/staff/products" />
              <StatCard icon={PackageX} label="Out of Stock" value={outOfStockCount} to="/staff/products" tone={outOfStockCount > 0 ? 'warning' : 'default'} />
            </>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {canAddProducts && (
            <Link to="/staff/products/new">
              <Card className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                  <Plus size={22} />
                </div>
                <span className="text-xs font-medium text-acc-text dark:text-white">Add Product</span>
              </Card>
            </Link>
          )}
          {canAddProducts && (
            <button onClick={() => setIsImportOpen(true)} className="text-left">
              <Card className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                  <FileUp size={22} />
                </div>
                <span className="text-xs font-medium text-acc-text dark:text-white">Import Products</span>
              </Card>
            </button>
          )}
          <Link to="/staff/products">
            <Card className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <ImagePlus size={22} />
              </div>
              <span className="text-xs font-medium text-acc-text dark:text-white">Upload Images</span>
            </Card>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Recently Added Products</h2>
          <Card hover={false}>
            {isLoadingProducts ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentlyAdded.length === 0 ? (
              <EmptyState icon={Sparkles} title="No products yet" description="Products you add will show up here." />
            ) : (
              <ul className="space-y-3">
                {recentlyAdded.map((p) => (
                  <li key={p.id}>
                    <Link to={`/staff/products/${p.id}/edit`} className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-acc-primary/5">
                      <ProductImage src={p.coverImage} alt={p.name} className="h-11 w-11 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-acc-text dark:text-white">{p.name}</p>
                        <p className="text-xs text-acc-text-secondary">
                          {formatCurrency(p.price)} · {p.status === 'draft' ? 'Draft' : 'Published'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-acc-text-secondary">{formatDateTime(p.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Inventory Alerts</h2>
          <Card hover={false}>
            {!canSeeInventory ? (
              <p className="py-6 text-center text-xs text-acc-text-secondary">You don't have inventory permissions.</p>
            ) : isLoadingInventory ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : alertProducts.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="All stocked up" description="Nothing among your products is low or out of stock." />
            ) : (
              <ul className="space-y-3">
                {alertProducts.map(({ product, inventory }) => (
                  <li key={product.id}>
                    <Link to="/staff/inventory" className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/10">
                      <ProductImage src={product.coverImage} alt={product.name} className="h-11 w-11 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-acc-text dark:text-white">{product.name}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">{inventory?.total_stock ?? 0} left</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Recent Activity</h2>
        {isLoadingActivity ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !activity || activity.length === 0 ? (
          <EmptyState icon={Clock} title="No activity yet" description="Actions you take (adding, editing products, updating stock) show up here." />
        ) : (
          <div className="relative space-y-3 pl-6">
            <div className="absolute bottom-2 left-[11px] top-2 w-px bg-acc-border dark:bg-primary-700" />
            {activity.map((entry) => {
              const Icon = ACTIVITY_ICON[entry.action];
              return (
                <div key={entry.id} className="relative">
                  <div className="absolute -left-6 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-acc-primary text-white ring-4 ring-acc-bg dark:ring-surface-dark">
                    <Icon size={12} />
                  </div>
                  <Card hover={false} className="p-3">
                    <p className="text-sm">
                      <span className="font-medium">{ACTIVITY_LABEL[entry.action]}</span>
                      {entry.target_label && <span className="text-acc-text-secondary"> · {entry.target_label}</span>}
                    </p>
                    <p className="text-xs text-acc-text-secondary">{formatDateTime(entry.created_at)}</p>
                  </Card>
                </div>
              );
            })}
            <Link to="/staff/activity" className="inline-block pl-1 text-xs font-medium text-acc-primary hover:underline">
              View all activity
            </Link>
          </div>
        )}
      </section>

      <ImportProductsModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, PackagePlus, FileEdit, Plus, Boxes, Clock, Search, SlidersHorizontal, Bell, ChevronRight } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductImage } from '@/components/ui/ProductImage';
import { StatCard, StatCardSkeleton } from '@/components/admin/dashboard/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminProducts } from '@/hooks/useAdminProducts';
import { useStaffPermissions } from '@/hooks/useStaff';
import { inventoryService } from '@/services/inventoryService';
import { categoryService } from '@/services/productService';
import { queryKeys } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import type { Product, Inventory } from '@/types';

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'draft';

const STOCK_FILTERS: { key: StockFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_stock', label: 'In Stock' },
  { key: 'low_stock', label: 'Low Stock' },
  { key: 'out_of_stock', label: 'Out of Stock' },
  { key: 'draft', label: 'Draft' },
];

/** Per-product stock status — same underlying logic as StaffDashboardPage's outOfStockCount/
 *  lowStockProducts derivation (real stock when inventory permission + data are available, falling
 *  back to the manually-set product status otherwise), just resolved per-product instead of counted. */
function stockStatus(
  product: Product,
  canSeeInventory: boolean,
  inventoryMap: Record<string, Inventory>,
): { label: string; tone: BadgeTone; stock: number | null } {
  if (!canSeeInventory) {
    if (product.status === 'out_of_stock') return { label: 'Out of Stock', tone: 'danger', stock: null };
    return { label: 'In Stock', tone: 'success', stock: null };
  }
  const inventory = inventoryMap[product.id];
  const stock = inventory?.total_stock ?? 0;
  if (stock <= 0) return { label: 'Out of Stock', tone: 'danger', stock };
  if (inventory && stock <= inventory.low_stock_threshold) return { label: 'Low Stock', tone: 'warning', stock };
  return { label: 'In Stock', tone: 'success', stock };
}

/** Compact mobile-first Staff Home — the phone-width counterpart to the full desktop dashboard in
 *  StaffDashboardPage (Overview/Quick Actions/Recently-Added/Inventory-Alerts/Activity, all of which
 *  stay exactly as-is for tablet/desktop). Same data, different layout: everything below is derived
 *  from the same real useAdminProducts()/inventoryService hooks the desktop dashboard already uses —
 *  nothing here is hardcoded or sample data. Stock lives on each product card (per the brief), not as
 *  a standalone "Out of Stock" overview tile. */
export function StaffMobileHome() {
  const { user } = useAuth();
  const { data: permissions } = useStaffPermissions();
  const { data: products = [], isLoading: isLoadingProducts } = useAdminProducts();
  const { data: categories = [] } = useQuery({ queryKey: queryKeys.categories.all, queryFn: () => categoryService.list() });
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const canAddProducts = Boolean(permissions?.add_products);
  const canSeeInventory = Boolean(permissions?.manage_inventory);

  const myProducts = useMemo(
    () => [...products.filter((p) => p.staff_id === user?.id)].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [products, user?.id],
  );
  const todayCount = useMemo(() => {
    const todayKey = new Date().toDateString();
    return myProducts.filter((p) => new Date(p.created_at).toDateString() === todayKey).length;
  }, [myProducts]);
  const draftCount = useMemo(() => myProducts.filter((p) => p.status === 'draft').length, [myProducts]);

  const { data: inventoryMap = {}, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['seller', 'inventory', 'batch', myProducts.map((p) => p.id)],
    queryFn: () => inventoryService.getInventoryBatch(myProducts.map((p) => p.id)),
    enabled: canSeeInventory && myProducts.length > 0,
  });

  const usedCategoryIds = useMemo(() => new Set(myProducts.map((p) => p.category_id)), [myProducts]);
  const categoryChips = useMemo(() => categories.filter((c) => usedCategoryIds.has(c.id)), [categories, usedCategoryIds]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myProducts.filter((p) => {
      if (categoryId && p.category_id !== categoryId) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      if (stockFilter === 'all') return true;
      if (stockFilter === 'draft') return p.status === 'draft';
      const { label } = stockStatus(p, canSeeInventory, inventoryMap);
      if (stockFilter === 'in_stock') return label === 'In Stock';
      if (stockFilter === 'low_stock') return label === 'Low Stock';
      if (stockFilter === 'out_of_stock') return label === 'Out of Stock';
      return true;
    });
  }, [myProducts, search, stockFilter, categoryId, canSeeInventory, inventoryMap]);

  const isFiltering = search.trim().length > 0 || stockFilter !== 'all' || categoryId !== null;
  const productsToShow = isFiltering ? filteredProducts : myProducts.slice(0, 5);

  return (
    <div className="space-y-6">
      <Seo title="Staff Dashboard" />
      {/* Header — StaffLayout's mobile identity strip already shows "Welcome, {name}" + store/role
          right above this, so this row only adds the title + a notifications shortcut. */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-acc-text dark:text-white">Staff Dashboard</p>
        <Link to="/staff/activity" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-card-dark" aria-label="Activity & notifications">
          <Bell size={18} className="text-acc-text dark:text-white" />
        </Link>
      </div>

      {/* Overview — same icon-card StatCard used by the Admin dashboard's mobile Home, so Staff
          matches that look exactly. 2-column grid (not 3) gives each card enough width for
          multi-word labels like "Total Products" next to the icon without wrapping. No standalone
          stock tile; stock lives on each product card below (see stockStatus above). */}
      <div className="grid grid-cols-2 gap-3">
        {isLoadingProducts ? (
          Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={PackagePlus} label="Added Today" value={todayCount} />
            <StatCard icon={Package} label="Total Products" value={myProducts.length} to="/staff/products" />
            <StatCard icon={FileEdit} label="Draft Products" value={draftCount} to="/staff/products" />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {canAddProducts ? (
            <Link to="/staff/products/new">
              <Card className="flex flex-col items-center gap-2 py-5 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-medium text-acc-text dark:text-white">Add Product</span>
              </Card>
            </Link>
          ) : (
            <Link to="/staff/products">
              <Card className="flex flex-col items-center gap-2 py-5 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                  <Package size={20} />
                </div>
                <span className="text-xs font-medium text-acc-text dark:text-white">Products</span>
              </Card>
            </Link>
          )}
          <Link to="/staff/inventory">
            <Card className="flex flex-col items-center gap-2 py-5 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <Boxes size={20} />
              </div>
              <span className="text-xs font-medium text-acc-text dark:text-white">Inventory</span>
            </Card>
          </Link>
          <Link to="/staff/activity">
            <Card className="flex flex-col items-center gap-2 py-5 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <Clock size={20} />
              </div>
              <span className="text-xs font-medium text-acc-text dark:text-white">My Activity</span>
            </Card>
          </Link>
        </div>
      </section>

      {/* Search + stock filter */}
      <section>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or SKU"
            aria-label="Search products or SKU"
            className="w-full rounded-xl border border-acc-border bg-white py-2.5 pl-9 pr-3 text-sm text-acc-text placeholder:text-primary-300 focus:border-acc-primary focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-primary-700 dark:bg-card-dark dark:text-white"
          />
        </div>
        <div className="scrollbar-none mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <SlidersHorizontal size={14} className="shrink-0 text-acc-text-secondary" />
          {STOCK_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStockFilter(key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                stockFilter === key ? 'bg-acc-primary text-white' : 'bg-white text-acc-text-secondary dark:bg-card-dark'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {categoryChips.length > 0 && (
          <div className="scrollbar-none mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryId(null)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryId === null ? 'bg-acc-text text-white dark:bg-white dark:text-acc-text' : 'bg-white text-acc-text-secondary dark:bg-card-dark'
              }`}
            >
              All Categories
            </button>
            {categoryChips.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  categoryId === c.id ? 'bg-acc-text text-white dark:bg-white dark:text-acc-text' : 'bg-white text-acc-text-secondary dark:bg-card-dark'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recent / filtered products — stock shown directly on each card, per the brief. */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">
          {isFiltering ? `Products (${filteredProducts.length})` : 'Recent Products'}
        </h2>
        {isLoadingProducts || (canSeeInventory && isLoadingInventory) ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : productsToShow.length === 0 ? (
          <EmptyState icon={Package} title="No products found" description={isFiltering ? 'Try a different search or filter.' : 'Products you add will show up here.'} />
        ) : (
          <div className="space-y-3">
            {productsToShow.map((p) => {
              const status = stockStatus(p, canSeeInventory, inventoryMap);
              return (
                <Link key={p.id} to={`/staff/products/${p.id}/edit`}>
                  <Card hover={false} className="flex items-center gap-3 p-3">
                    <ProductImage src={p.coverImage} alt={p.name} className="h-16 w-14 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{p.name}</p>
                      <p className="truncate text-xs text-acc-text-secondary">SKU: {p.sku}</p>
                      <p className="mt-0.5 text-sm font-bold text-acc-text dark:text-white">{formatCurrency(p.price)}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {status.stock !== null && <span className="text-xs text-acc-text-secondary">Stock: {status.stock}</span>}
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-acc-text-secondary" />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

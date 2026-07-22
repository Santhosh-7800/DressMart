import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, IndianRupee, Package, AlertTriangle, Clock, CheckCircle2, RotateCcw, Wallet } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Skeleton } from '@/components/ui/Skeleton';
import { SimpleBarChart } from '@/components/admin/SimpleBarChart';
import { useAdminOrders, useAdminReturns } from '@/hooks/useAdminOrders';
import { adminProductService } from '@/services/adminProductService';
import { formatCurrency, formatDate } from '@/lib/utils';

const PENDING_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery'];

function isSameDay(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === reference.getFullYear() && d.getMonth() === reference.getMonth() && d.getDate() === reference.getDate();
}

function StatTile({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string }) {
  return (
    <div className="admin-stat-card">
      <div className="mb-2 flex items-center gap-2 text-white/85">
        <Icon size={16} />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export function AdminDashboardPage() {
  const { data: orders, isLoading: isLoadingOrders } = useAdminOrders();
  const { data: returns, isLoading: isLoadingReturns } = useAdminReturns();
  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['admin', 'dashboard', 'products'],
    queryFn: () => adminProductService.list('', 1, 2000),
  });

  const isLoading = isLoadingOrders || isLoadingReturns || isLoadingProducts;

  const stats = useMemo(() => {
    const now = new Date();
    const allOrders = orders ?? [];
    const products = productData?.items ?? [];
    const todaysOrders = allOrders.filter((o) => isSameDay(o.placed_at, now));
    const todaysRevenue = todaysOrders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0);
    const pending = allOrders.filter((o) => PENDING_STATUSES.includes(o.status)).length;
    const completed = allOrders.filter((o) => o.status === 'delivered').length;
    const outOfStock = products.filter((p) => p.total_stock <= 0).length;
    const refunds = (returns ?? []).filter((r) => r.status === 'refunded').length;

    const salesByProduct = new Map<string, { name: string; image: string; qty: number }>();
    allOrders.forEach((order) => {
      if (order.status === 'cancelled') return;
      order.items.forEach((item) => {
        const existing = salesByProduct.get(item.product_id);
        salesByProduct.set(item.product_id, {
          name: item.product_name,
          image: item.product_image,
          qty: (existing?.qty ?? 0) + item.quantity,
        });
      });
    });
    const topProducts = [...salesByProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    const monthly: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = monthDate.toLocaleDateString('en-IN', { month: 'short' });
      const total = allOrders
        .filter((o) => o.status !== 'cancelled')
        .filter((o) => {
          const d = new Date(o.placed_at);
          return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
        })
        .reduce((sum, o) => sum + o.total, 0);
      monthly.push({ label, value: total });
    }

    const recentOrders = [...allOrders].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()).slice(0, 8);

    return {
      todaysOrdersCount: todaysOrders.length,
      todaysRevenue,
      totalProducts: productData?.total ?? products.length,
      outOfStock,
      pending,
      completed,
      returnsCount: (returns ?? []).length,
      refunds,
      topProducts,
      monthly,
      recentOrders,
    };
  }, [orders, returns, productData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <Seo title="Admin — Dashboard" />
      <div className="mb-5 flex items-center gap-2">
        <LayoutDashboard size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={ShoppingBag} label="Today's Orders" value={String(stats.todaysOrdersCount)} />
        <StatTile icon={IndianRupee} label="Today's Revenue" value={formatCurrency(stats.todaysRevenue)} />
        <StatTile icon={Package} label="Total Products" value={String(stats.totalProducts)} />
        <StatTile icon={AlertTriangle} label="Out of Stock" value={String(stats.outOfStock)} />
        <StatTile icon={Clock} label="Pending Orders" value={String(stats.pending)} />
        <StatTile icon={CheckCircle2} label="Completed Orders" value={String(stats.completed)} />
        <StatTile icon={RotateCcw} label="Returns" value={String(stats.returnsCount)} />
        <StatTile icon={Wallet} label="Refunds" value={String(stats.refunds)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Monthly Sales</h2>
          <SimpleBarChart data={stats.monthly} formatValue={formatCurrency} />
        </div>
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Top Selling Products</h2>
          <div className="space-y-2.5">
            {stats.topProducts.map((p, i) => (
              <div key={p.name + i} className="flex items-center gap-3">
                <span className="w-4 text-sm font-semibold text-primary-300">{i + 1}</span>
                <img src={p.image} alt="" className="h-9 w-8 rounded-md object-cover" />
                <span className="line-clamp-1 flex-1 text-sm">{p.name}</span>
                <span className="text-sm font-semibold">{p.qty} sold</span>
              </div>
            ))}
            {stats.topProducts.length === 0 && <p className="py-4 text-center text-sm text-primary-400">No sales yet.</p>}
          </div>
        </div>
      </div>

      <div className="card-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm font-medium text-accent-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {stats.recentOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between border-b border-primary-100 py-2 text-sm last:border-0 dark:border-primary-700">
              <span>
                #{o.order_number} · {formatDate(o.placed_at)}
              </span>
              <span className="capitalize text-primary-400">{o.status.replace(/_/g, ' ')}</span>
              <span className="font-semibold">{formatCurrency(o.total)}</span>
            </div>
          ))}
          {stats.recentOrders.length === 0 && <p className="py-4 text-center text-sm text-primary-400">No orders yet.</p>}
        </div>
      </div>
    </div>
  );
}

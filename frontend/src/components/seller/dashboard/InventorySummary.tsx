import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Boxes, PackageX, Zap, Sparkles, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductImage } from '@/components/ui/ProductImage';
import { formatCurrency } from '@/lib/utils';
import { useLowStockList, useOutOfStockList, useDealsEndingSoon, useRecentlyAddedProducts, useTopSellingProducts } from '@/hooks/useDashboardData';
import type { Product } from '@/types';
import type { TopProductRow } from '@/services/sellerStatsService';

function ProductRow({ image, name, detail }: { image: string; name: string; detail: string }) {
  return (
    <li className="flex items-center gap-3">
      <ProductImage src={image} alt={name} className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-acc-text dark:text-white">{name}</p>
        <p className="truncate text-xs text-acc-text-secondary">{detail}</p>
      </div>
    </li>
  );
}

function InventoryListCard({
  title,
  icon: Icon,
  isLoading,
  emptyLabel,
  rows,
}: {
  title: string;
  icon: LucideIcon;
  isLoading: boolean;
  emptyLabel: string;
  rows: { image: string; name: string; detail: string }[] | undefined;
}) {
  return (
    <Card hover={false}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-acc-text dark:text-white">
        <Icon size={16} className="text-acc-primary" /> {title}
      </h3>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-acc-text-secondary">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <ProductRow key={i} {...r} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function InventorySummary({ sellerId, isHeadSeller }: { sellerId: string; isHeadSeller: boolean }) {
  const lowStockQuery = useLowStockList(sellerId);
  const outOfStockQuery = useOutOfStockList(sellerId);
  const dealsEndingQuery = useDealsEndingSoon(sellerId);
  const recentlyAddedQuery = useRecentlyAddedProducts(sellerId);
  const topSellingQuery = useTopSellingProducts(sellerId, isHeadSeller);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Inventory</h2>
        <Link to="/seller/inventory" className="text-xs font-medium text-acc-primary hover:underline">
          Manage inventory
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InventoryListCard
          title="Low Stock"
          icon={Boxes}
          isLoading={lowStockQuery.isLoading}
          emptyLabel="Nothing running low."
          rows={lowStockQuery.data?.map(({ product, inventory }: { product: Product; inventory: { total_stock: number } }) => ({
            image: product.coverImage,
            name: product.name,
            detail: `${inventory.total_stock} left`,
          }))}
        />
        <InventoryListCard
          title="Out of Stock"
          icon={PackageX}
          isLoading={outOfStockQuery.isLoading}
          emptyLabel="Nothing out of stock."
          rows={outOfStockQuery.data?.map(({ product }: { product: Product }) => ({
            image: product.coverImage,
            name: product.name,
            detail: 'Restock needed',
          }))}
        />
        <InventoryListCard
          title="Deals Ending Soon"
          icon={Zap}
          isLoading={dealsEndingQuery.isLoading}
          emptyLabel="No deals ending in the next 3 days."
          rows={dealsEndingQuery.data?.map((p: Product) => ({
            image: p.coverImage,
            name: p.name,
            detail: p.deal_ends_at ? `Ends ${new Date(p.deal_ends_at).toLocaleDateString('en-IN')}` : '',
          }))}
        />
        <InventoryListCard
          title="Recently Added"
          icon={Sparkles}
          isLoading={recentlyAddedQuery.isLoading}
          emptyLabel="No products added yet."
          rows={recentlyAddedQuery.data?.map((p: Product) => ({
            image: p.coverImage,
            name: p.name,
            detail: formatCurrency(p.price),
          }))}
        />
        <InventoryListCard
          title="Top Selling"
          icon={TrendingUp}
          isLoading={topSellingQuery.isLoading}
          emptyLabel="No sales yet."
          rows={topSellingQuery.data?.map((p: TopProductRow) => ({
            image: '',
            name: p.product_name,
            detail: `${p.units_sold} sold — ${formatCurrency(p.revenue)}`,
          }))}
        />
      </div>
    </section>
  );
}

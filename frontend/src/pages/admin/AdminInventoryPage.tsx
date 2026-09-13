import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Boxes, ChevronDown, ChevronUp, Search, AlertTriangle, SlidersHorizontal, History } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useAdminProducts } from '@/hooks/useAdminProducts';
import { useUpdateStock, useInventoryMovements } from '@/hooks/useInventory';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { inventoryService } from '@/services/inventoryService';
import { StockAdjustModal, type StockAdjustTarget } from '@/components/admin/StockAdjustModal';
import { cn, formatDateTime } from '@/lib/utils';
import type { Product } from '@/types';

const MOVEMENT_LABELS: Record<string, string> = {
  sale: 'Sale',
  cancellation: 'Order cancelled',
  return: 'Returned',
  exchange_out: 'Exchanged out',
  exchange_in: 'Exchanged in',
  manual_increase: 'Manual increase',
  manual_decrease: 'Manual decrease',
  initial_stock: 'Initial stock',
};

function MovementHistoryPanel({ productId }: { productId: string }) {
  const { data: movements, isLoading } = useInventoryMovements(productId);
  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!movements || movements.length === 0) {
    return <p className="py-3 text-center text-xs text-primary-400">No stock movements recorded yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {movements.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-sm dark:bg-primary-900">
          <div className="min-w-0">
            <p className="font-medium text-primary-700 dark:text-primary-200">
              {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type} · SKU {m.sku}
            </p>
            {m.reason && <p className="truncate text-primary-400">{m.reason}</p>}
            <p className="text-primary-400">{formatDateTime(m.created_at)}</p>
          </div>
          <span className={cn('shrink-0 font-semibold', m.quantity_changed >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {m.quantity_changed >= 0 ? '+' : ''}
            {m.quantity_changed} → {m.new_quantity}
          </span>
        </li>
      ))}
    </ul>
  );
}

const PAGE_SIZE = 20;

function VariantStockEditor({
  product,
  initialStock,
  initialThreshold,
  initialUpdatedAt,
  onAdjust,
}: {
  product: Product;
  initialStock: Record<string, number>;
  initialThreshold: number;
  initialUpdatedAt?: string;
  onAdjust: (target: StockAdjustTarget) => void;
}) {
  const [stock, setStock] = useState<Record<string, number>>(initialStock);
  const [threshold, setThreshold] = useState(initialThreshold);
  const [showHistory, setShowHistory] = useState(false);
  const updateStock = useUpdateStock();
  const isOnline = useOnlineStatus();

  const total = Object.values(stock).reduce((sum, n) => sum + Math.max(0, n || 0), 0);

  const handleSave = () => {
    // Same reasoning as the product form's save guard — a Firestore write made while offline
    // queues locally and never resolves/rejects until reconnected, so without this the button
    // would just spin forever instead of clearly saying nothing was saved.
    if (!isOnline) {
      toast.error("You're offline. Reconnect and try updating stock again.");
      return;
    }
    updateStock.mutate({
      productId: product.id,
      variantStock: stock,
      lowStockThreshold: threshold,
      expectedUpdatedAt: initialUpdatedAt,
      sellerId: product.seller_id,
      productName: product.name,
    });
  };

  return (
    <div className="space-y-3 rounded-xl bg-primary-50 p-4 dark:bg-primary-800/50">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {product.variants.map((variant) => (
          <div key={variant.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm dark:bg-primary-900">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: variant.color_hex }} />
              {variant.color} · {variant.size}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={stock[variant.id] ?? 0}
                onChange={(e) => setStock((prev) => ({ ...prev, [variant.id]: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-16 rounded-md border border-primary-200 px-2 py-1 text-right text-sm dark:border-primary-600 dark:bg-primary-800"
              />
              <button
                type="button"
                title="Quick adjust with reason"
                onClick={() => onAdjust({ product, variant, currentStock: stock[variant.id] ?? 0 })}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-primary-400 hover:bg-primary-100 hover:text-accent dark:hover:bg-primary-800"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary-200 pt-3 dark:border-primary-700">
        <label className="flex items-center gap-2 text-sm">
          Low-stock alert below
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
            className="w-16 rounded-md border border-primary-200 px-2 py-1 text-right text-sm dark:border-primary-600 dark:bg-primary-800"
          />
          units
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-primary-500">Total: {total}</span>
          <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
            <History size={13} /> History
          </Button>
          <Button variant="accent" size="sm" onClick={handleSave} isLoading={updateStock.isPending}>
            Save Stock
          </Button>
        </div>
      </div>
      {showHistory && (
        <div className="border-t border-primary-200 pt-3 dark:border-primary-700">
          <MovementHistoryPanel productId={product.id} />
        </div>
      )}
    </div>
  );
}

type StockFilter = 'all' | 'low' | 'out' | 'discontinued';

const STOCK_FILTER_LABELS: Record<StockFilter, string> = { all: 'All', low: 'Low Stock', out: 'Out of Stock', discontinued: 'Discontinued' };

export function AdminInventoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<StockAdjustTarget | null>(null);
  // ?stock=low|out drives a dedicated Low-Stock/Out-of-Stock view — linked to directly from the
  // Dashboard's InventorySummary widget so "Update Stock" is reachable in one tap instead of
  // landing on the full unfiltered list. ?highlight=<productId> auto-expands and scrolls to one
  // specific product (used when a dashboard row links to an exact item, not just the filter).
  const [searchParams, setSearchParams] = useSearchParams();
  const stockFilter = (searchParams.get('stock') as StockFilter | null) ?? 'all';
  const highlightId = searchParams.get('highlight');

  const { data: products = [], isLoading: isLoadingProducts, isError: isProductsError, refetch: refetchProducts } = useAdminProducts();
  const { data: inventoryMap = {}, isLoading: isLoadingInventory, isError: isInventoryError, refetch: refetchInventory } = useQuery({
    queryKey: ['seller', 'inventory', 'batch', products.map((p) => p.id)],
    queryFn: () => inventoryService.getInventoryBatch(products.map((p) => p.id)),
    enabled: products.length > 0,
  });

  const isLoading = isLoadingProducts || isLoadingInventory;
  const isError = isProductsError || isInventoryError;

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = search.trim().toLowerCase();
        if (q) {
          const matchesProduct = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
          const matchesVariant = p.variants.some(
            (v) => v.sku.toLowerCase().includes(q) || v.color.toLowerCase().includes(q) || v.size.toLowerCase().includes(q),
          );
          if (!matchesProduct && !matchesVariant) return false;
        }
        if (stockFilter === 'all') return true;
        if (stockFilter === 'discontinued') return p.status === 'hidden';
        const inv = inventoryMap[p.id];
        const totalStock = inv?.total_stock ?? 0;
        const threshold = inv?.low_stock_threshold ?? 5;
        return stockFilter === 'out' ? totalStock <= 0 : totalStock > 0 && totalStock <= threshold;
      }),
    [products, search, stockFilter, inventoryMap],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Auto-expand + scroll to a dashboard-linked product once its data has loaded.
  useEffect(() => {
    if (!highlightId || isLoading) return;
    setExpandedId(highlightId);
    document.getElementById(`inventory-row-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, isLoading]);

  const setStockFilter = (next: StockFilter) => {
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('stock');
    else params.set('stock', next);
    params.delete('highlight');
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <Seo title="Seller — Inventory" />
      <div className="mb-5 flex items-center gap-2">
        <Boxes size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Inventory</h1>
      </div>

      <div className="mb-3 flex gap-2">
        {(Object.keys(STOCK_FILTER_LABELS) as StockFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => setStockFilter(key)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium',
              stockFilter === key ? 'bg-accent text-primary-900' : 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
            )}
          >
            {STOCK_FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name, SKU, color, or size"
          leftIcon={<Search size={15} />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card hover={false} className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="text-red-500" size={24} />
          <p className="text-sm text-primary-500">Couldn't load inventory.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchProducts();
              void refetchInventory();
            }}
          >
            Retry
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        stockFilter === 'low' ? (
          <EmptyState icon={Boxes} title="All products are sufficiently stocked" description="Nothing is currently below its low-stock threshold." />
        ) : stockFilter === 'out' ? (
          <EmptyState icon={Boxes} title="Nothing is out of stock" description="Every product currently has stock available." />
        ) : stockFilter === 'discontinued' ? (
          <EmptyState icon={Boxes} title="No discontinued products" description="Every product in your catalog is currently active." />
        ) : products.length === 0 ? (
          <EmptyState icon={Boxes} title="No products yet" description="Add a product first, then manage its stock here." />
        ) : (
          <EmptyState icon={Search} title="No matches" description="No products match your search." />
        )
      ) : (
        <div className="space-y-2">
          {pageItems.map((product) => {
            const inventory = inventoryMap[product.id];
            const totalStock = inventory?.total_stock ?? 0;
            const threshold = inventory?.low_stock_threshold ?? 5;
            const isLow = totalStock > 0 && totalStock <= threshold;
            const isOut = totalStock <= 0;
            const isExpanded = expandedId === product.id;

            return (
              <div key={product.id} id={`inventory-row-${product.id}`} className="card-surface overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : product.id)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <img src={product.imageUrl ?? product.images[0]?.url} alt="" className="h-11 w-10 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="text-xs text-primary-400">{product.sku} · {product.variants.length} variants</p>
                  </div>
                  {product.status === 'hidden' && (
                    <span className="shrink-0 rounded-full bg-primary-200 px-2.5 py-1 text-xs font-semibold text-primary-600 dark:bg-primary-700 dark:text-primary-200">
                      Discontinued
                    </span>
                  )}
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                      isOut ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : isLow ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
                    )}
                  >
                    {isOut ? 'Out of stock' : isLow ? `Low stock · ${totalStock}` : `${totalStock} in stock`}
                  </span>
                  {isExpanded ? <ChevronUp size={18} className="shrink-0 text-primary-400" /> : <ChevronDown size={18} className="shrink-0 text-primary-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-primary-100 p-3 dark:border-primary-700">
                    <VariantStockEditor
                      product={product}
                      initialStock={inventory?.variant_stock ?? Object.fromEntries(product.variants.map((v) => [v.id, 0]))}
                      initialThreshold={threshold}
                      initialUpdatedAt={inventory?.updated_at}
                      onAdjust={setAdjustTarget}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <StockAdjustModal target={adjustTarget} sellerId={adjustTarget?.product.seller_id ?? ''} onClose={() => setAdjustTarget(null)} />
    </div>
  );
}

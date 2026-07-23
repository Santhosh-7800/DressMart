import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSellerProducts } from '@/hooks/useSellerProducts';
import { useUpdateStock } from '@/hooks/useInventory';
import { inventoryService } from '@/services/inventoryService';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

const PAGE_SIZE = 20;

function VariantStockEditor({ product, initialStock, initialThreshold }: { product: Product; initialStock: Record<string, number>; initialThreshold: number }) {
  const [stock, setStock] = useState<Record<string, number>>(initialStock);
  const [threshold, setThreshold] = useState(initialThreshold);
  const updateStock = useUpdateStock();

  const total = Object.values(stock).reduce((sum, n) => sum + Math.max(0, n || 0), 0);

  const handleSave = () => {
    updateStock.mutate({ productId: product.id, variantStock: stock, lowStockThreshold: threshold });
  };

  return (
    <div className="space-y-3 rounded-xl bg-primary-50 p-4 dark:bg-primary-800/50">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {product.variants.map((variant) => (
          <label key={variant.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm dark:bg-primary-900">
            <span className="flex items-center gap-1.5 truncate">
              <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: variant.color_hex }} />
              {variant.color} · {variant.size}
            </span>
            <input
              type="number"
              min={0}
              value={stock[variant.id] ?? 0}
              onChange={(e) => setStock((prev) => ({ ...prev, [variant.id]: Math.max(0, Number(e.target.value) || 0) }))}
              className="w-16 shrink-0 rounded-md border border-primary-200 px-2 py-1 text-right text-sm dark:border-primary-600 dark:bg-primary-800"
            />
          </label>
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
          <Button variant="accent" size="sm" onClick={handleSave} isLoading={updateStock.isPending}>
            Save Stock
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SellerInventoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: products = [], isLoading: isLoadingProducts } = useSellerProducts();
  const { data: inventoryMap = {}, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['seller', 'inventory', 'batch', products.map((p) => p.id)],
    queryFn: () => inventoryService.getInventoryBatch(products.map((p) => p.id)),
    enabled: products.length > 0,
  });

  const isLoading = isLoadingProducts || isLoadingInventory;

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = search.trim().toLowerCase();
        return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      }),
    [products, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <Seo title="Seller — Inventory" />
      <div className="mb-5 flex items-center gap-2">
        <Boxes size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Inventory</h1>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name or SKU"
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
      ) : filtered.length === 0 ? (
        <EmptyState icon={Boxes} title="No products yet" description="Add a product first, then manage its stock here." />
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
              <div key={product.id} className="card-surface overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : product.id)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <img src={product.imageUrl ?? product.images[0]?.url} alt="" className="h-11 w-10 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="text-xs text-primary-400">{product.sku} · {product.variants.length} variants</p>
                  </div>
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
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

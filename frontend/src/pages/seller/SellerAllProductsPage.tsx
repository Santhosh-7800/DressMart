import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, EyeOff, Trash2, Pencil, Star, Layers, Zap } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useAllSellerProducts, useSetProductStatus, useSetProductFeatured, useSetProductDealOfDay, useDeleteProduct } from '@/hooks/useSellerProducts';
import { formatCurrency, cn } from '@/lib/utils';
import type { Product, ProductStatus } from '@/types';

const PAGE_SIZE = 20;

const STATUS_TABS: { value: ProductStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'hidden', label: 'Hidden' },
];

const STATUS_BADGE_CLASS: Record<ProductStatus, string> = {
  draft: 'badge bg-primary-100 text-primary-600 dark:bg-primary-700 dark:text-primary-200',
  active: 'badge-success',
  out_of_stock: 'badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  hidden: 'badge-danger',
};

const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  out_of_stock: 'Out of Stock',
  hidden: 'Hidden',
};

/** The Feature/Deal-of-Day toggles — shared between the desktop table row and the mobile card. */
function ProductBadgeToggles({ product, onToggleFeatured, onToggleDeal }: { product: Product; onToggleFeatured: () => void; onToggleDeal: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onToggleFeatured}
        className={cn('tap-target-48 flex items-center gap-1 rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700', product.is_featured && 'text-amber-500')}
        title={product.is_featured ? 'Unfeature' : 'Feature'}
        aria-label={product.is_featured ? 'Unfeature product' : 'Feature product'}
      >
        <Star size={15} fill={product.is_featured ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={onToggleDeal}
        className={cn('tap-target-48 flex items-center gap-1 rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700', product.is_deal_of_day && 'text-accent')}
        title={product.is_deal_of_day ? 'Remove from Deal of the Day' : 'Add to Deal of the Day'}
        aria-label={product.is_deal_of_day ? 'Remove from Deal of the Day' : 'Add to Deal of the Day'}
      >
        <Zap size={15} fill={product.is_deal_of_day ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

/** Edit/Hide-Unhide/Delete — shared between the desktop table row and the mobile card. */
function ProductRowActions({ product, onToggleHidden, onDelete }: { product: Product; onToggleHidden: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link to={`/seller/products/${product.id}/edit`} className="tap-target-48 rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700" title="Edit" aria-label="Edit product">
        <Pencil size={15} />
      </Link>
      <button onClick={onToggleHidden} className="tap-target-48 rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700" title={product.status === 'hidden' ? 'Unhide' : 'Hide'} aria-label={product.status === 'hidden' ? 'Unhide product' : 'Hide product'}>
        {product.status === 'hidden' ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
      <button onClick={onDelete} className="tap-target-48 rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete" aria-label="Delete product">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

/**
 * Head-Seller-only view of every product across every seller — mirrors SellerProductsPage's
 * layout/actions but adds a Seller Name column plus the Feature/Unfeature toggle that's not
 * available on the regular per-seller Products page. Route: /seller/all-products.
 */
export function SellerAllProductsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [dealsOnly, setDealsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [dealTarget, setDealTarget] = useState<Product | null>(null);
  const [dealEndsAt, setDealEndsAt] = useState('');

  const { data: allProducts = [], isLoading } = useAllSellerProducts();
  const setStatus = useSetProductStatus();
  const setFeatured = useSetProductFeatured();
  const setDealOfDay = useSetProductDealOfDay();
  const remove = useDeleteProduct();

  const filtered = allProducts.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (dealsOnly && !p.is_deal_of_day) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.seller_name.toLowerCase().includes(q);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusCounts = STATUS_TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.value] = tab.value === 'all' ? allProducts.length : allProducts.filter((p) => p.status === tab.value).length;
    return acc;
  }, {});

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This cannot be undone.`)) remove.mutate(id);
  };

  const handleToggleDeal = (product: Product) => {
    if (product.is_deal_of_day) {
      setDealOfDay.mutate({ productId: product.id, isDeal: false, dealEndsAt: null });
    } else {
      setDealTarget(product);
      setDealEndsAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    }
  };

  const confirmDeal = () => {
    if (!dealTarget) return;
    setDealOfDay.mutate(
      { productId: dealTarget.id, isDeal: true, dealEndsAt: new Date(dealEndsAt).toISOString() },
      { onSuccess: () => setDealTarget(null) },
    );
  };

  return (
    <div>
      <Seo title="Seller — All Products" />
      <div className="mb-5 flex items-center gap-2">
        <Layers size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">All Products</h1>
      </div>
      <p className="mb-5 text-sm text-primary-500">Every product across every seller, regardless of status.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              statusFilter === tab.value
                ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/30'
                : 'border-primary-200 text-primary-500 hover:bg-primary-50 dark:border-primary-600 dark:hover:bg-primary-800',
            )}
          >
            {tab.label} ({statusCounts[tab.value] ?? 0})
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setDealsOnly((v) => !v);
            setPage(1);
          }}
          className={cn(
            'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
            dealsOnly
              ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/30'
              : 'border-primary-200 text-primary-500 hover:bg-primary-50 dark:border-primary-600 dark:hover:bg-primary-800',
          )}
        >
          <Zap size={13} className="mr-1 inline" /> Deals only ({allProducts.filter((p) => p.is_deal_of_day).length})
        </button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name, SKU, or seller"
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
      ) : allProducts.length === 0 ? (
        <EmptyState icon={Layers} title="No products yet" description="Products created by any seller will show up here." />
      ) : (
        <>
          {/* Desktop/tablet: dense data table. */}
          <div className="admin-table-wrap scrollbar-thin hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-primary-100 text-left text-xs uppercase tracking-wide text-primary-400 dark:border-primary-700">
                  <th className="p-3">Product</th>
                  <th className="p-3">Seller</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Featured</th>
                  <th className="p-3">Deal</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((product) => (
                  <tr key={product.id} className="border-b border-primary-100 last:border-0 dark:border-primary-700">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={product.coverImage || product.images[0]?.url}
                          alt=""
                          className="h-11 w-10 shrink-0 rounded-[16px] object-cover shadow-sm ring-1 ring-admin-border transition-transform duration-200 hover:scale-105"
                        />
                        <span className="line-clamp-2 max-w-[220px] font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-primary-500">{product.seller_name}</td>
                    <td className="p-3 text-primary-500">{product.sku}</td>
                    <td className="p-3">{formatCurrency(product.price)}</td>
                    <td className="p-3">
                      <span className={STATUS_BADGE_CLASS[product.status]}>{STATUS_LABEL[product.status]}</span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setFeatured.mutate({ productId: product.id, featured: !product.is_featured })}
                        className={cn(
                          'flex items-center gap-1 rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700',
                          product.is_featured && 'text-amber-500',
                        )}
                        title={product.is_featured ? 'Unfeature' : 'Feature'}
                      >
                        <Star size={15} fill={product.is_featured ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleDeal(product)}
                        className={cn(
                          'flex items-center gap-1 rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700',
                          product.is_deal_of_day && 'text-accent',
                        )}
                        title={product.is_deal_of_day ? 'Remove from Deal of the Day' : 'Add to Deal of the Day'}
                      >
                        <Zap size={15} fill={product.is_deal_of_day ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="p-3">
                      <ProductRowActions
                        product={product}
                        onToggleHidden={() => setStatus.mutate({ productId: product.id, status: product.status === 'hidden' ? 'active' : 'hidden' })}
                        onDelete={() => handleDelete(product.id, product.name)}
                      />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-primary-400">
                      No products match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards — same data/actions as the table above, one product per card. */}
          <div className="space-y-3 md:hidden">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-primary-400">No products match your search.</p>
            ) : (
              items.map((product) => (
                <Card key={product.id} hover={false} className="p-3">
                  <div className="flex gap-3">
                    <img src={product.coverImage || product.images[0]?.url} alt="" className="h-16 w-14 shrink-0 rounded-2xl object-cover shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-primary-400">
                        {product.seller_name} · SKU: {product.sku}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-semibold">{formatCurrency(product.price)}</span>
                        <span className={STATUS_BADGE_CLASS[product.status]}>{STATUS_LABEL[product.status]}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-primary-100 pt-2 dark:border-primary-700">
                    <ProductBadgeToggles
                      product={product}
                      onToggleFeatured={() => setFeatured.mutate({ productId: product.id, featured: !product.is_featured })}
                      onToggleDeal={() => handleToggleDeal(product)}
                    />
                    <ProductRowActions
                      product={product}
                      onToggleHidden={() => setStatus.mutate({ productId: product.id, status: product.status === 'hidden' ? 'active' : 'hidden' })}
                      onDelete={() => handleDelete(product.id, product.name)}
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <Modal isOpen={Boolean(dealTarget)} onClose={() => setDealTarget(null)} title={`Add "${dealTarget?.name ?? ''}" to Deal of the Day`}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Deal ends at</label>
            <input type="datetime-local" value={dealEndsAt} onChange={(e) => setDealEndsAt(e.target.value)} className="input-field" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setDealTarget(null)}>
              Cancel
            </Button>
            <Button variant="account" fullWidth onClick={confirmDeal} isLoading={setDealOfDay.isPending}>
              Add to Deal of the Day
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Search, Eye, EyeOff, Trash2, Pencil, AlertTriangle, PackageSearch } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerProducts, useSetProductStatus, useDeleteProduct } from '@/hooks/useSellerProducts';
import { inventoryService } from '@/services/inventoryService';
import { formatCurrency, cn } from '@/lib/utils';
import type { ProductStatus } from '@/types';

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

export function SellerProductsPage() {
  const { user } = useAuth();
  const isPending = user?.seller_status === 'pending';
  const isSuspendedOrRejected = user?.seller_status === 'suspended' || user?.seller_status === 'rejected';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const { data: allProducts = [], isLoading: isLoadingProducts } = useSellerProducts();
  const { data: inventoryMap = {}, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['seller', 'inventory', 'batch', allProducts.map((p) => p.id)],
    queryFn: () => inventoryService.getInventoryBatch(allProducts.map((p) => p.id)),
    enabled: allProducts.length > 0,
  });

  const setStatus = useSetProductStatus();
  const remove = useDeleteProduct();

  const isLoading = isLoadingProducts || isLoadingInventory;

  const filteredProducts = allProducts.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const total = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusCounts = STATUS_TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.value] = tab.value === 'all' ? allProducts.length : allProducts.filter((p) => p.status === tab.value).length;
    return acc;
  }, {});

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((p) => p.id))));
  };

  const handleBulkStatus = async (status: ProductStatus) => {
    setIsBulkProcessing(true);
    try {
      await Promise.all([...selectedIds].map((id) => setStatus.mutateAsync({ productId: id, status })));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} product(s)? This cannot be undone.`)) return;
    setIsBulkProcessing(true);
    try {
      await Promise.all([...selectedIds].map((id) => remove.mutateAsync(id)));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div>
      <Seo title="Seller — Products" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        {!isPending && !isSuspendedOrRejected && (
          <Link to="/seller/products/new" className="btn-accent text-sm">
            <Plus size={15} /> Add Product
          </Link>
        )}
      </div>

      {isPending && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Your seller application is awaiting approval</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              You can't add or publish products yet — this unlocks as soon as the Head Seller approves your account.
            </p>
          </div>
        </div>
      )}
      {isSuspendedOrRejected && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Your seller account is {user?.seller_status}</p>
            <p className="mt-0.5">{user?.seller_status_reason ?? 'You cannot add or edit products while your account is in this state.'}</p>
          </div>
        </div>
      )}

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

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-accent-50 p-3 text-sm dark:bg-accent-900/20">
          <span className="font-medium">{selectedIds.size} selected</span>
          <Button variant="outline" size="sm" onClick={() => handleBulkStatus('active')} isLoading={isBulkProcessing}>
            Bulk Publish
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkStatus('hidden')} isLoading={isBulkProcessing}>
            Bulk Hide
          </Button>
          <Button variant="danger" size="sm" onClick={handleBulkDelete} isLoading={isBulkProcessing}>
            Bulk Delete
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : allProducts.length === 0 && isPending ? (
        <EmptyState
          icon={PackageSearch}
          title="Nothing to show yet"
          description="Once your seller application is approved, you'll be able to add your first product here."
        />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-left text-xs uppercase tracking-wide text-primary-400 dark:border-primary-700">
                <th className="p-3">
                  <input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="h-4 w-4 rounded" />
                </th>
                <th className="p-3">Product</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Price</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => {
                const stock = inventoryMap[product.id]?.total_stock ?? 0;
                return (
                  <tr key={product.id} className="border-b border-primary-100 last:border-0 dark:border-primary-700">
                    <td className="p-3">
                      <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelected(product.id)} className="h-4 w-4 rounded" />
                    </td>
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
                    <td className="p-3 text-primary-500">{product.sku}</td>
                    <td className="p-3">{formatCurrency(product.price)}</td>
                    <td className={cn('p-3', stock <= 0 && 'font-semibold text-red-500')}>{stock}</td>
                    <td className="p-3">
                      <span className={STATUS_BADGE_CLASS[product.status]}>{STATUS_LABEL[product.status]}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/seller/products/${product.id}/edit`} className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700" title="Edit">
                          <Pencil size={15} />
                        </Link>
                        {product.status === 'active' ? (
                          <button
                            onClick={() => setStatus.mutate({ productId: product.id, status: 'hidden' })}
                            className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700"
                            title="Hide"
                          >
                            <EyeOff size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus.mutate({ productId: product.id, status: 'active' })}
                            className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700"
                            title="Publish"
                          >
                            <Eye size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${product.name}"? This cannot be undone.`)) remove.mutate(product.id);
                          }}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-primary-400">
                    No products match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

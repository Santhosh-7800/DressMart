import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Search, Copy, Eye, EyeOff, Trash2, Pencil, Upload, Download, AlertTriangle, PackageSearch } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSellerProducts,
  useCreateProduct,
  useSetProductActive,
  useDeleteProduct,
} from '@/hooks/useSellerProducts';
import { inventoryService } from '@/services/inventoryService';
import { parseCsvToRecords } from '@/lib/csv';
import { formatCurrency, cn } from '@/lib/utils';
import type { Product, SellerProductInput } from '@/types';

const PAGE_SIZE = 20;

function csvRowToInput(row: Record<string, string>): SellerProductInput {
  return {
    name: row.name ?? '',
    sku: row.sku ?? '',
    brand_id: row.brand_id ?? '',
    category_id: row.category_id ?? '',
    gender: (row.gender === 'kids' ? 'kids' : 'men') as 'men' | 'kids',
    description: row.description ?? '',
    price: Number(row.price) || 0,
    mrp: Number(row.mrp) || Number(row.price) || 0,
    gst_percent: Number(row.gst_percent) || 5,
    material: row.material ?? '',
    fit: row.fit ?? '',
    wash_care: row.wash_care ?? '',
    sizes: (row.sizes ?? '').split('|').map((s) => s.trim()).filter(Boolean),
    colors: (row.colors ?? '')
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((name) => ({ name, hex: '#888888' })),
    stock_quantity: Number(row.stock_quantity) || 0,
    low_stock_threshold: Number(row.low_stock_threshold) || 5,
    images: [],
    is_active: row.is_active !== 'false',
    is_return_eligible: row.is_return_eligible !== 'false',
    is_exchange_eligible: row.is_exchange_eligible !== 'false',
  };
}

export function SellerProductsPage() {
  const { user } = useAuth();
  const isPending = user?.seller_status === 'pending';
  const isSuspendedOrRejected = user?.seller_status === 'suspended' || user?.seller_status === 'rejected';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allProducts = [], isLoading: isLoadingProducts } = useSellerProducts();
  const { data: inventoryMap = {}, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['seller', 'inventory', 'batch', allProducts.map((p) => p.id)],
    queryFn: () => inventoryService.getInventoryBatch(allProducts.map((p) => p.id)),
    enabled: allProducts.length > 0,
  });

  const createProduct = useCreateProduct();
  const setActive = useSetProductActive();
  const remove = useDeleteProduct();

  const isLoading = isLoadingProducts || isLoadingInventory;

  const filteredProducts = allProducts.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const total = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  const handleDuplicate = async (product: Product) => {
    const input: SellerProductInput = {
      name: `${product.name} (Copy)`,
      sku: `${product.sku}-COPY`,
      brand_id: product.brand_id,
      category_id: product.category_id,
      gender: product.gender,
      description: product.description,
      price: product.price,
      mrp: product.mrp,
      gst_percent: product.gst_percent,
      material: product.specifications.material,
      fit: product.specifications.fit,
      wash_care: product.specifications.wash_care ?? '',
      sizes: [...new Set(product.variants.map((v) => v.size))],
      colors: [...new Map(product.variants.map((v) => [v.color, { name: v.color, hex: v.color_hex }])).values()],
      stock_quantity: 0,
      low_stock_threshold: inventoryMap[product.id]?.low_stock_threshold ?? 5,
      images: product.images.map((i) => i.url),
      is_return_eligible: product.is_return_eligible ?? true,
      is_exchange_eligible: product.is_exchange_eligible ?? true,
      is_active: false,
    };
    try {
      await createProduct.mutateAsync(input);
      toast.success('Product duplicated as a draft');
    } catch (e: any) {
      toast.error(e.message || 'Duplication failed');
    }
  };

  const handleBulkAction = async (action: 'publish' | 'hide' | 'delete') => {
    setIsBulkProcessing(true);
    try {
      if (action === 'delete') {
        if (!confirm(`Delete ${selectedIds.size} product(s)? This cannot be undone.`)) return;
        await Promise.all([...selectedIds].map((id) => remove.mutateAsync(id)));
        toast.success('Selected products deleted');
      } else {
        const isActive = action === 'publish';
        await Promise.all([...selectedIds].map((id) => setActive.mutateAsync({ productId: id, isActive })));
        toast.success(`Selected products ${isActive ? 'published' : 'hidden'}`);
      }
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || 'Bulk action failed');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsvToRecords(text);
    if (rows.length === 0) {
      toast.error('No rows found in that CSV');
      return;
    }
    const inputs = rows.map(csvRowToInput);
    setIsBulkProcessing(true);
    try {
      await Promise.all(inputs.map((input) => createProduct.mutateAsync(input)));
      toast.success(`Successfully imported ${inputs.length} product(s)`);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
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
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = '';
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} isLoading={isBulkProcessing}>
              <Upload size={14} /> Bulk Import
            </Button>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent('name,sku,brand_id,category_id,gender,description,price,mrp,gst_percent,material,fit,wash_care,sizes,colors,stock_quantity,low_stock_threshold,is_active,is_return_eligible,is_exchange_eligible\n')}`}
              download="product-import-template.csv"
              className="btn-outline text-sm"
            >
              <Download size={14} /> CSV Template
            </a>
            <Link to="/seller/products/new" className="btn-accent text-sm">
              <Plus size={15} /> Add Product
            </Link>
          </div>
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
            <p className="mt-0.5">
              {user?.seller_status_reason ?? 'You cannot add or edit products while your account is in this state.'}
            </p>
          </div>
        </div>
      )}

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction('publish')}
            isLoading={isBulkProcessing}
          >
            Bulk Publish
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction('hide')}
            isLoading={isBulkProcessing}
          >
            Bulk Hide
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleBulkAction('delete')}
            isLoading={isBulkProcessing}
          >
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
                          src={product.imageUrl ?? product.images[0]?.url}
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
                      <span className={product.is_active ? 'badge-success' : 'badge-danger'}>{product.is_active ? 'Published' : 'Hidden'}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/seller/products/${product.id}/edit`} className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700" title="Edit">
                          <Pencil size={15} />
                        </Link>
                        <button
                          onClick={() => handleDuplicate(product)}
                          className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700"
                          title="Duplicate"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => setActive.mutate({ productId: product.id, isActive: !product.is_active })}
                          className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700"
                          title={product.is_active ? 'Hide' : 'Publish'}
                        >
                          {product.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
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

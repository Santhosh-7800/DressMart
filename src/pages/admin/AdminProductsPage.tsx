import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Copy, Eye, EyeOff, Trash2, Pencil, Upload, Download } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useAdminProducts,
  useBulkImportProducts,
  useBulkProductAction,
  useDeleteProduct,
  useDuplicateProduct,
  useSetProductActive,
} from '@/hooks/useAdminProducts';
import { parseCsvToRecords } from '@/lib/csv';
import { formatCurrency, cn } from '@/lib/utils';
import type { AdminProductInput } from '@/types';

const PAGE_SIZE = 20;

function csvRowToInput(row: Record<string, string>): AdminProductInput {
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
    sleeve: row.sleeve ?? '',
    collar: row.collar ?? '',
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
    is_featured: row.is_featured === 'true',
    is_trending: row.is_trending === 'true',
    is_bestseller: row.is_bestseller === 'true',
    is_new_arrival: row.is_new_arrival === 'true',
  };
}

export function AdminProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useAdminProducts(search, page, PAGE_SIZE);
  const setActive = useSetProductActive();
  const duplicate = useDuplicateProduct();
  const remove = useDeleteProduct();
  const bulkAction = useBulkProductAction();
  const bulkImport = useBulkImportProducts();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsvToRecords(text);
    if (rows.length === 0) {
      toast.error('No rows found in that CSV');
      return;
    }
    await bulkImport.mutateAsync(rows.map(csvRowToInput));
  };

  return (
    <div>
      <Seo title="Admin — Products" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
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
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} isLoading={bulkImport.isPending}>
            <Upload size={14} /> Bulk Import
          </Button>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent('name,sku,brand_id,category_id,gender,description,price,mrp,gst_percent,material,fit,sleeve,collar,sizes,colors,stock_quantity,low_stock_threshold,is_active,is_featured,is_trending,is_bestseller,is_new_arrival\n')}`}
            download="product-import-template.csv"
            className="btn-outline text-sm"
          >
            <Download size={14} /> CSV Template
          </a>
          <Link to="/admin/products/new" className="btn-accent text-sm">
            <Plus size={15} /> Add Product
          </Link>
        </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await bulkAction.mutateAsync({ productIds: [...selectedIds], action: 'publish' });
              setSelectedIds(new Set());
            }}
          >
            Bulk Publish
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await bulkAction.mutateAsync({ productIds: [...selectedIds], action: 'hide' });
              setSelectedIds(new Set());
            }}
          >
            Bulk Hide
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!confirm(`Delete ${selectedIds.size} product(s)? This cannot be undone.`)) return;
              await bulkAction.mutateAsync({ productIds: [...selectedIds], action: 'delete' });
              setSelectedIds(new Set());
            }}
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
              {items.map((product) => (
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
                  <td className={cn('p-3', product.total_stock <= 0 && 'font-semibold text-red-500')}>{product.total_stock}</td>
                  <td className="p-3">
                    <span className={product.is_active ? 'badge-success' : 'badge-danger'}>{product.is_active ? 'Published' : 'Hidden'}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/admin/products/${product.id}/edit`} className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700" title="Edit">
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => duplicate.mutate(product)}
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
              ))}
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

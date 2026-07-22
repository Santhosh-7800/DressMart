import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Search } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { adminProductService } from '@/services/adminProductService';
import { adminDataService } from '@/services/adminDataService';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

export function AdminInventoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['admin', 'inventory', 'products'],
    queryFn: () => adminProductService.list('', 1, 2000),
  });
  const { data: orders, isLoading: isLoadingOrders } = useQuery({ queryKey: ['admin', 'inventory', 'orders'], queryFn: () => adminDataService.getAllOrders() });
  const { data: cartItems, isLoading: isLoadingCart } = useQuery({ queryKey: ['admin', 'inventory', 'cart'], queryFn: () => adminDataService.getAllCartItems() });

  const isLoading = isLoadingProducts || isLoadingOrders || isLoadingCart;

  const rows = useMemo(() => {
    const products = productData?.items ?? [];
    const soldByProduct = new Map<string, number>();
    (orders ?? []).forEach((order) => {
      if (order.status === 'cancelled') return;
      order.items.forEach((item) => {
        soldByProduct.set(item.product_id, (soldByProduct.get(item.product_id) ?? 0) + item.quantity);
      });
    });
    const reservedByProduct = new Map<string, number>();
    (cartItems ?? []).forEach((item) => {
      if (item.saved_for_later) return;
      reservedByProduct.set(item.product_id, (reservedByProduct.get(item.product_id) ?? 0) + item.quantity);
    });

    return products
      .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()) || p.sku.toLowerCase().includes(search.trim().toLowerCase()))
      .map((p) => {
        const sold = soldByProduct.get(p.id) ?? 0;
        const reserved = reservedByProduct.get(p.id) ?? 0;
        const remaining = Math.max(p.total_stock - reserved, 0);
        return {
          product: p,
          currentStock: p.total_stock,
          sold,
          reserved,
          remaining,
          isLowStock: remaining > 0 && remaining <= p.low_stock_threshold,
          isOutOfStock: remaining <= 0,
        };
      });
  }, [productData, orders, cartItems, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <Seo title="Admin — Inventory" />
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
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-left text-xs uppercase tracking-wide text-primary-400 dark:border-primary-700">
                <th className="p-3">Product</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Sold</th>
                <th className="p-3">Reserved</th>
                <th className="p-3">Remaining</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ product, currentStock, sold, reserved, remaining, isLowStock, isOutOfStock }) => (
                <tr key={product.id} className="border-b border-primary-100 last:border-0 dark:border-primary-700">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <img src={product.imageUrl ?? product.images[0]?.url} alt="" className="h-9 w-8 shrink-0 rounded-md object-cover" />
                      <span className="line-clamp-2 max-w-[200px] font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="p-3">{currentStock}</td>
                  <td className="p-3">{sold}</td>
                  <td className="p-3">{reserved}</td>
                  <td className={cn('p-3 font-semibold', isOutOfStock && 'text-red-500', isLowStock && 'text-amber-600')}>{remaining}</td>
                  <td className="p-3">
                    {isOutOfStock ? (
                      <span className="badge-danger">Out of Stock</span>
                    ) : isLowStock ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Low Stock</span>
                    ) : (
                      <span className="badge-success">In Stock</span>
                    )}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-primary-400">
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

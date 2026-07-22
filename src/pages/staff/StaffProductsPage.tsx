import { Link } from 'react-router-dom';
import { Plus, Pencil, Package } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffProducts } from '@/hooks/useStaffProducts';
import { formatCurrency } from '@/lib/utils';
import type { ApprovalStatus } from '@/types';

const STATUS_BADGE: Record<ApprovalStatus, string> = {
  draft: 'admin-badge-info',
  pending: 'admin-badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  draft: 'Draft',
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function StaffProductsPage() {
  const { user } = useAuth();
  const { data: products, isLoading } = useStaffProducts(user?.id);
  const items = products ?? [];

  return (
    <div>
      <Seo title="Staff — Products" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package size={22} className="text-admin-orange" />
          <h1 className="text-2xl font-bold text-admin-text">My Products</h1>
        </div>
        <Link to="/staff/products/new" className="btn-accent text-sm">
          <Plus size={15} /> Add Product
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Products you add will show up here once submitted." />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide">
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
                <tr key={product.id}>
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={product.imageUrl ?? product.images[0]?.url}
                        alt=""
                        className="h-11 w-10 shrink-0 rounded-[16px] object-cover shadow-sm ring-1 ring-admin-border"
                      />
                      <span className="line-clamp-2 max-w-[220px] font-medium text-admin-text">{product.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-admin-text-secondary">{product.sku}</td>
                  <td className="p-3 text-admin-text">{formatCurrency(product.price)}</td>
                  <td className="p-3 text-admin-text">{product.total_stock}</td>
                  <td className="p-3">
                    <span className={STATUS_BADGE[product.approval_status ?? 'pending']}>{STATUS_LABEL[product.approval_status ?? 'pending']}</span>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      to={`/staff/products/${product.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-admin-orange hover:bg-admin-orange/10"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

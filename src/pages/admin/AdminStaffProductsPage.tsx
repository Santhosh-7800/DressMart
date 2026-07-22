import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PackageSearch, Check, X, Pencil, Trash2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useStaffSubmissions, useApproveStaffProduct, useRejectStaffProduct, useDeleteProduct } from '@/hooks/useAdminProducts';
import { formatCurrency, cn } from '@/lib/utils';
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

const FILTERS: { key: ApprovalStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export function AdminStaffProductsPage() {
  const { data: products, isLoading } = useStaffSubmissions();
  const approve = useApproveStaffProduct();
  const reject = useRejectStaffProduct();
  const remove = useDeleteProduct();
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('pending');
  const [searchParams, setSearchParams] = useSearchParams();
  const staffId = searchParams.get('staffId');

  const byStaff = (products ?? []).filter((p) => !staffId || p.created_by_id === staffId);
  const items = byStaff.filter((p) => filter === 'all' || (p.approval_status ?? 'pending') === filter);
  const staffName = staffId ? byStaff[0]?.created_by_name ?? null : null;

  return (
    <div>
      <Seo title="Admin — Staff Products" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PackageSearch size={22} className="text-admin-orange" />
          <h1 className="text-2xl font-bold">Staff Products</h1>
        </div>
        <div className="flex gap-1 rounded-lg bg-admin-bg p-1 text-sm">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn('rounded-md px-3 py-1.5 font-medium transition-colors', filter === key ? 'bg-white text-admin-orange shadow-sm' : 'text-admin-text-secondary')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {staffId && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-admin-orange/10 px-3.5 py-2 text-sm text-admin-orange">
          <span>Showing products for {staffName ?? 'this staff member'}</span>
          <button onClick={() => setSearchParams({})} className="font-medium underline">
            Clear filter
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={PackageSearch} title="Nothing here" description="Products submitted by staff will show up here for review." />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide">
                <th className="p-3">Product</th>
                <th className="p-3">Submitted By</th>
                <th className="p-3">Shop</th>
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
                      <img src={product.imageUrl ?? product.images[0]?.url} alt="" className="h-11 w-10 shrink-0 rounded-[16px] object-cover shadow-sm ring-1 ring-admin-border" />
                      <span className="line-clamp-2 max-w-[220px] font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-admin-text-secondary">
                    {product.created_by_name ?? '—'}
                    {product.department && <span className="block text-xs">{product.department}</span>}
                  </td>
                  <td className="p-3 text-admin-text-secondary">{product.shop_name ?? '—'}</td>
                  <td className="p-3">{formatCurrency(product.price)}</td>
                  <td className={cn('p-3', product.total_stock <= 0 && 'font-semibold text-red-500')}>{product.total_stock}</td>
                  <td className="p-3">
                    <span className={STATUS_BADGE[product.approval_status ?? 'pending']}>{STATUS_LABEL[product.approval_status ?? 'pending']}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {(product.approval_status ?? 'pending') !== 'approved' && (
                        <button onClick={() => approve.mutate(product.id)} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" title="Approve">
                          <Check size={15} />
                        </button>
                      )}
                      {(product.approval_status ?? 'pending') !== 'rejected' && (
                        <button onClick={() => reject.mutate(product.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" title="Reject">
                          <X size={15} />
                        </button>
                      )}
                      <Link to={`/admin/products/${product.id}/edit`} className="rounded-lg p-1.5 hover:bg-admin-orange/10" title="Edit">
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${product.name}"? This cannot be undone.`)) remove.mutate(product.id);
                        }}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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

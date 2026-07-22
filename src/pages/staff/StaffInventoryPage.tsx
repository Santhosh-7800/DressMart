import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Check } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffProducts, useUpdateStaffProduct } from '@/hooks/useStaffProducts';
import { staffService } from '@/services/staffService';
import type { StaffContext } from '@/services/staffProductService';
import { cn } from '@/lib/utils';
import type { StaffProductInput } from '@/types';

/** Quick stock edits for the staff member's own products — reuses staffProductService.update()
 *  (via the existing hook) rather than a separate stock-only endpoint, so every edit still goes
 *  through the same "resubmit for approval" workflow as the full product form. */
export function StaffInventoryPage() {
  const { user } = useAuth();
  const { data: products, isLoading } = useStaffProducts(user?.id);
  const { data: staffDetails } = useQuery({ queryKey: ['staff', 'details', user?.id], queryFn: () => staffService.getDetails(user!.id), enabled: Boolean(user?.id) });
  const staffContext: StaffContext | undefined = user && staffDetails
    ? { id: user.id, name: user.full_name, employeeId: staffDetails.employee_id, department: staffDetails.department, shopName: staffDetails.shop_name }
    : undefined;
  const updateProduct = useUpdateStaffProduct(staffContext);
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  const items = products ?? [];

  const toInput = (product: (typeof items)[number], stock: number): StaffProductInput => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    brand_id: product.brand_id,
    category_id: product.category_id,
    gender: product.gender,
    description: product.description,
    price: product.price,
    mrp: product.mrp,
    material: product.specifications.material,
    specifications: product.specifications.other_specs ?? '',
    sizes: [...new Set(product.variants.map((v) => v.size))],
    colors: [...new Map(product.variants.map((v) => [v.color, { name: v.color, hex: v.color_hex }])).values()],
    stock_quantity: stock,
    images: product.galleryImages ?? product.images.map((i) => i.url),
    tags: product.tags,
    is_active: product.is_active,
  });

  return (
    <div>
      <Seo title="Staff — Inventory" />
      <div className="mb-5 flex items-center gap-2">
        <Boxes size={22} className="text-admin-orange" />
        <h1 className="text-2xl font-bold text-admin-text">Inventory</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Boxes} title="Nothing to stock yet" description="Add a product first, then manage its stock here." />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide">
                <th className="p-3">Product</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Current Stock</th>
                <th className="p-3">Update Stock</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((product) => {
                const draft = drafts[product.id];
                const isDirty = draft !== undefined && draft !== product.total_stock;
                return (
                  <tr key={product.id}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <img src={product.imageUrl ?? product.images[0]?.url} alt="" className="h-10 w-10 shrink-0 rounded-[14px] object-cover ring-1 ring-admin-border" />
                        <span className="line-clamp-2 max-w-[200px] font-medium text-admin-text">{product.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-admin-text-secondary">{product.sku}</td>
                    <td className={cn('p-3 font-medium', product.total_stock <= 0 ? 'text-red-500' : 'text-admin-text')}>{product.total_stock}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        className="input-field h-9 w-24"
                        value={draft ?? product.total_stock}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [product.id]: Number(e.target.value) }))}
                      />
                    </td>
                    <td className="p-3">
                      <Button
                        variant="accent"
                        size="sm"
                        disabled={!isDirty}
                        isLoading={updateProduct.isPending}
                        onClick={async () => {
                          await updateProduct.mutateAsync({ input: toInput(product, draft as number), status: product.approval_status === 'draft' ? 'draft' : 'pending' });
                          setDrafts((prev) => {
                            const next = { ...prev };
                            delete next[product.id];
                            return next;
                          });
                        }}
                      >
                        <Check size={14} /> Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

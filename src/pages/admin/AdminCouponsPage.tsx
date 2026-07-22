import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Ticket, Plus, Trash2, Pencil } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { couponService } from '@/services/couponService';
import { formatDate } from '@/lib/utils';
import type { Coupon } from '@/types';

function emptyCoupon(): Coupon {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    code: '',
    description: '',
    discount_type: 'percent',
    discount_value: 10,
    min_order_value: 0,
    max_discount: null,
    valid_from: now.toISOString(),
    valid_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    usage_limit: null,
    used_count: 0,
    granted_to_user_id: null,
  };
}

export function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const { data: coupons, isLoading } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => couponService.listAllForAdmin() });

  const save = useMutation({
    mutationFn: (coupon: Coupon) => couponService.save(coupon),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('Coupon saved');
      setIsModalOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => couponService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('Coupon deleted');
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Coupon>(emptyCoupon());

  const publicCoupons = (coupons ?? []).filter((c) => !c.granted_to_user_id);

  return (
    <div>
      <Seo title="Admin — Coupons" />
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket size={22} className="text-accent" />
          <h1 className="text-2xl font-bold">Coupons</h1>
        </div>
        <Button
          variant="accent"
          size="sm"
          onClick={() => {
            setForm(emptyCoupon());
            setIsModalOpen(true);
          }}
        >
          <Plus size={15} /> Add Coupon
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-left text-xs uppercase tracking-wide text-primary-400 dark:border-primary-700">
                <th className="p-3">Code</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Min Order</th>
                <th className="p-3">Valid Until</th>
                <th className="p-3">Used</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {publicCoupons.map((c) => (
                <tr key={c.id} className="border-b border-primary-100 last:border-0 dark:border-primary-700">
                  <td className="p-3 font-mono font-semibold">{c.code}</td>
                  <td className="p-3">{c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`}</td>
                  <td className="p-3">₹{c.min_order_value}</td>
                  <td className="p-3 text-primary-400">{formatDate(c.valid_until)}</td>
                  <td className="p-3">
                    {c.used_count}
                    {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                  </td>
                  <td className="p-3">
                    <span className={c.is_active ? 'badge-success' : 'badge-danger'}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setForm(c);
                          setIsModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700"
                      >
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => remove.mutate(c.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {publicCoupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-primary-400">
                    No coupons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={form.code ? 'Edit Coupon' : 'Add Coupon'}>
        <div className="space-y-3">
          <Input label="Code" name="coupon-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <Input label="Description" name="coupon-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-sm font-medium">Discount Type</p>
              <select className="input-field" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as Coupon['discount_type'] })}>
                <option value="percent">Percent</option>
                <option value="flat">Flat</option>
              </select>
            </div>
            <Input label="Discount Value" name="coupon-discount-value" type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min Order Value" name="coupon-min-order" type="number" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: Number(e.target.value) })} />
            <Input
              label="Valid Until"
              name="coupon-valid-until"
              type="date"
              value={form.valid_until.slice(0, 10)}
              onChange={(e) => setForm({ ...form, valid_until: new Date(e.target.value).toISOString() })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded" />
            Active
          </label>
          <Button variant="accent" fullWidth onClick={() => save.mutate(form)} isLoading={save.isPending}>
            Save Coupon
          </Button>
        </div>
      </Modal>
    </div>
  );
}

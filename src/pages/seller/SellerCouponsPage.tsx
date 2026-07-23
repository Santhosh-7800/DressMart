import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Ticket, Power } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatDate } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
// NOTE: the Account/Coupon-owning agent is (re)building src/services/couponService.ts against this
// exact named-export interface for the post-Firebase-migration Coupon shape (types/database.ts).
// The file currently on disk still targets the pre-migration Supabase schema, so these imports won't
// resolve until that agent finishes — see the "known gaps" note in this workstream's final report.
import { createCoupon, updateCoupon, setCouponActive, listAllCoupons } from '@/services/couponService';
import type { Coupon } from '@/types';

type CouponFormState = {
  code: string;
  description: string;
  discount_type: Coupon['discount_type'];
  discount_value: number;
  min_order_value: number;
  max_discount: number | null;
  valid_from: string;
  valid_until: string;
  usage_limit: number | null;
};

const EMPTY_FORM: CouponFormState = {
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: 10,
  min_order_value: 0,
  max_discount: null,
  valid_from: new Date().toISOString().slice(0, 10),
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  usage_limit: null,
};

function couponToForm(coupon: Coupon): CouponFormState {
  return {
    code: coupon.code,
    description: coupon.description,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    min_order_value: coupon.min_order_value,
    max_discount: coupon.max_discount,
    valid_from: coupon.valid_from.slice(0, 10),
    valid_until: coupon.valid_until.slice(0, 10),
    usage_limit: coupon.usage_limit,
  };
}

export function SellerCouponsPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);

  const couponsQuery = useQuery({ queryKey: queryKeys.coupons.all, queryFn: () => listAllCoupons() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.coupons.all });

  const createMutation = useMutation({
    mutationFn: () =>
      createCoupon({
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_order_value: form.min_order_value,
        max_discount: form.max_discount,
        valid_from: new Date(form.valid_from).toISOString(),
        valid_until: new Date(form.valid_until).toISOString(),
        usage_limit: form.usage_limit,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success('Coupon created');
      invalidate();
      setIsFormOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not create coupon.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingCoupon) throw new Error('No coupon selected.');
      return updateCoupon(editingCoupon.id, {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_order_value: form.min_order_value,
        max_discount: form.max_discount,
        valid_from: new Date(form.valid_from).toISOString(),
        valid_until: new Date(form.valid_until).toISOString(),
        usage_limit: form.usage_limit,
      });
    },
    onSuccess: () => {
      toast.success('Coupon updated');
      invalidate();
      setIsFormOpen(false);
      setEditingCoupon(null);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not update coupon.'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ coupon, isActive }: { coupon: Coupon; isActive: boolean }) => setCouponActive(coupon.id, isActive),
    onSuccess: () => {
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Could not update coupon status.'),
  });

  const openCreate = () => {
    setEditingCoupon(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setForm(couponToForm(coupon));
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.code.trim()) {
      toast.error('Coupon code is required.');
      return;
    }
    if (editingCoupon) updateMutation.mutate();
    else createMutation.mutate();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const coupons = couponsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Seo title="Coupons" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Coupons</h1>
        <Button variant="account" onClick={openCreate}>
          <Plus size={16} /> New Coupon
        </Button>
      </div>

      {couponsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState icon={Ticket} title="No coupons yet" description="Use the New Coupon button above to create your first platform-wide coupon." />
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id} hover={false} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-base font-bold text-acc-text dark:text-white">{coupon.code}</p>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      coupon.is_active
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
                    )}
                  >
                    {coupon.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-acc-text-secondary">{coupon.description}</p>
                <p className="text-xs text-acc-text-secondary">
                  {coupon.discount_type === 'percent' ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`} · Min order ₹
                  {coupon.min_order_value} · Valid {formatDate(coupon.valid_from)} – {formatDate(coupon.valid_until)} · Used {coupon.used_count}
                  {coupon.usage_limit ? `/${coupon.usage_limit}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(coupon)}>
                  <Pencil size={14} /> Edit
                </Button>
                <Button
                  size="sm"
                  variant={coupon.is_active ? 'danger' : 'account'}
                  onClick={() => toggleActiveMutation.mutate({ coupon, isActive: !coupon.is_active })}
                  isLoading={toggleActiveMutation.isPending}
                >
                  <Power size={14} /> {coupon.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingCoupon ? 'Edit Coupon' : 'New Coupon'}>
        <div className="space-y-4">
          <Input floating label="Coupon Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input floating label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-3">
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Discount Type</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as Coupon['discount_type'] })}
                className="input-field"
              >
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <Input
              floating
              label="Discount Value"
              type="number"
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
            />
          </div>
          <div className="flex gap-3">
            <Input
              floating
              label="Min Order Value"
              type="number"
              value={form.min_order_value}
              onChange={(e) => setForm({ ...form, min_order_value: Number(e.target.value) })}
            />
            <Input
              floating
              label="Max Discount (optional)"
              type="number"
              value={form.max_discount ?? ''}
              onChange={(e) => setForm({ ...form, max_discount: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="flex gap-3">
            <Input floating label="Valid From" type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            <Input floating label="Valid Until" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </div>
          <Input
            floating
            label="Usage Limit (optional)"
            type="number"
            value={form.usage_limit ?? ''}
            onChange={(e) => setForm({ ...form, usage_limit: e.target.value === '' ? null : Number(e.target.value) })}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="account" fullWidth onClick={handleSubmit} isLoading={isSaving}>
              {editingCoupon ? 'Save Changes' : 'Create Coupon'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

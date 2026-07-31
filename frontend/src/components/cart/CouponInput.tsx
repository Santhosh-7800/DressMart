import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Tag, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Coupon } from '@/types';
import { db } from '@/lib/firebase';

interface CouponInputProps {
  appliedCoupon: Coupon | null;
  onApply: (coupon: Coupon) => void;
  onRemove: () => void;
  orderValue: number;
}

/**
 * Coupon docs are keyed by their code (`coupons/{code}`) — validated entirely client-side here
 * for the cart/checkout estimate. The authoritative discount is recomputed server-side inside
 * verifyAndPlaceOrder/placeCodOrder, so a stale/tampered client read can never affect the real charge.
 */
async function fetchAndValidateCoupon(code: string, orderValue: number): Promise<Coupon> {
  const snap = await getDoc(doc(db, 'coupons', code.toUpperCase()));
  if (!snap.exists()) throw new Error('Invalid coupon code.');
  const coupon = { id: snap.id, ...snap.data() } as Coupon;

  if (!coupon.is_active) throw new Error('This coupon is no longer active.');
  const now = new Date();
  if (now < new Date(coupon.valid_from) || now > new Date(coupon.valid_until)) {
    throw new Error('This coupon has expired.');
  }
  if (orderValue < coupon.min_order_value) {
    throw new Error(`Add items worth ₹${coupon.min_order_value - orderValue} more to use this coupon.`);
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    throw new Error('This coupon has reached its usage limit.');
  }
  return coupon;
}

export function CouponInput({ appliedCoupon, onApply, onRemove, orderValue }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setIsValidating(true);
    try {
      const coupon = await fetchAndValidateCoupon(code.trim(), orderValue);
      onApply(coupon);
      toast.success(`Coupon "${coupon.code}" applied!`);
      setCode('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid coupon');
    } finally {
      setIsValidating(false);
    }
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{appliedCoupon.code}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">{appliedCoupon.description}</p>
          </div>
        </div>
        <button onClick={onRemove} aria-label="Remove coupon" className="text-emerald-600 hover:text-emerald-800">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter coupon code"
          className="input-field pl-9 uppercase"
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
      </div>
      <button onClick={handleApply} disabled={isValidating || !code.trim()} className="btn-outline shrink-0">
        {isValidating ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
      </button>
    </div>
  );
}

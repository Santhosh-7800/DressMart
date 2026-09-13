import { useState } from 'react';
import { Tag, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Coupon } from '@/types';
import { validateCoupon, type CartLineForCoupon } from '@/services/couponService';
import { useAuth } from '@/contexts/AuthContext';

interface CouponInputProps {
  appliedCoupon: Coupon | null;
  onApply: (coupon: Coupon) => void;
  onRemove: () => void;
  /** One entry per cart line — needed (not just a total) so category-restricted coupons can be
   *  previewed accurately. The authoritative discount is always recomputed server-side inside
   *  verifyAndPlaceOrder/placeCodOrder, so a stale/tampered client read can never affect the real charge. */
  cartLines: CartLineForCoupon[];
}

export function CouponInput({ appliedCoupon, onApply, onRemove, cartLines }: CouponInputProps) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setIsValidating(true);
    try {
      const result = await validateCoupon(code.trim(), cartLines, user?.id ?? null);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      onApply(result.coupon);
      toast.success(`Coupon "${result.coupon.code}" applied!`);
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

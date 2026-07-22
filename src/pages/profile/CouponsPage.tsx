import { useState } from 'react';
import { Ticket, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Seo } from '@/components/common/Seo';
import { useCoupons } from '@/hooks/useCoupons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';

export function CouponsPage() {
  const { data: coupons, isLoading } = useCoupons();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied "${code}"`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div>
      <Seo title="Coupons" />
      <h1 className="mb-6 text-2xl font-bold">Coupons &amp; Offers</h1>

      {isLoading && <Skeleton className="h-24 w-full" />}

      {!isLoading && (coupons ?? []).length === 0 && <EmptyState icon={Ticket} title="No coupons available" description="Check back soon for new offers." />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(coupons ?? []).map((coupon) => (
          <div key={coupon.id} className="card-surface relative overflow-hidden border-l-4 border-accent p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold tracking-wide">{coupon.code}</p>
                <p className="text-sm text-primary-500">{coupon.description}</p>
              </div>
              <button onClick={() => handleCopy(coupon.code)} className="flex items-center gap-1 rounded-lg bg-primary-100 px-2.5 py-1.5 text-xs font-medium dark:bg-primary-700">
                {copiedCode === coupon.code ? <Check size={13} /> : <Copy size={13} />}
                {copiedCode === coupon.code ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-primary-400">
              <span>Min order: {formatCurrency(coupon.min_order_value)}</span>
              {coupon.max_discount && <span>Max discount: {formatCurrency(coupon.max_discount)}</span>}
              <span>Valid until {formatDate(coupon.valid_until)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

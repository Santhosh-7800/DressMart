import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { useOrders } from '@/hooks/useOrders';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { PaymentMethod } from '@/types';

const METHODS: { value: PaymentMethod; label: string; description: string; icon: typeof CreditCard }[] = [
  {
    value: 'razorpay',
    label: 'Razorpay (UPI / Card / Netbanking)',
    description: 'Pay instantly via UPI, debit/credit card, netbanking or wallet.',
    icon: CreditCard,
  },
  {
    value: 'cod',
    label: 'Cash on Delivery',
    description: 'Pay in cash when your order arrives. A small COD fee may apply.',
    icon: Banknote,
  },
];

/**
 * DressMart never vaults card/UPI details itself — Razorpay's own hosted checkout handles that —
 * so this page has nothing of that kind to manage. What it DOES own: which method is pre-selected
 * the next time you check out (a plain local preference, same pattern as the delivery pincode —
 * see useLocalStorage — not a Firestore field) and a read-only summary of how past orders were
 * paid for, derived entirely from existing order data.
 */
export function PaymentsPage() {
  const { data: orders } = useOrders();
  const [preferredMethod, setPreferredMethod] = useLocalStorage<PaymentMethod>('dressmart:preferred-payment-method', 'razorpay');

  const recentPayments = useMemo(
    () => [...(orders ?? [])].sort((a, b) => +new Date(b.placed_at) - +new Date(a.placed_at)).slice(0, 5),
    [orders],
  );

  return (
    <div className="space-y-6">
      <Seo title="Payment Methods" description="Manage your default payment method and view past payment activity on DressMart." />
      <h1 className="hidden text-2xl font-bold md:block">Payment Methods</h1>

      <Card>
        <h2 className="mb-1 text-base font-bold text-acc-text dark:text-white">Default Payment Method</h2>
        <p className="mb-4 text-xs text-acc-text-secondary">Pre-selected the next time you check out — you can still switch it at checkout.</p>
        <div className="space-y-3">
          {METHODS.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreferredMethod(value)}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                preferredMethod === value
                  ? 'border-acc-primary bg-acc-primary/5'
                  : 'border-acc-border hover:bg-acc-primary/5 dark:border-primary-700',
              )}
            >
              <Icon size={20} className={cn('mt-0.5 shrink-0', preferredMethod === value ? 'text-acc-primary' : 'text-acc-text-secondary')} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-acc-text dark:text-white">{label}</p>
                <p className="text-xs text-acc-text-secondary">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-1 flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-600" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Secure Payments</h2>
        </div>
        <p className="text-xs text-acc-text-secondary">
          All online payments are processed securely through Razorpay. DressMart never stores your card, UPI, or banking details.
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-bold text-acc-text dark:text-white">Recent Payment Activity</h2>
        {recentPayments.length === 0 ? (
          <p className="py-4 text-center text-sm text-acc-text-secondary">Your past order payments will show up here.</p>
        ) : (
          <div className="space-y-2">
            {recentPayments.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-2xl border border-acc-border p-3 transition-colors hover:border-acc-primary/40 hover:bg-acc-primary/5 dark:border-primary-700"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-acc-text dark:text-white">#{order.order_number}</p>
                  <p className="text-xs text-acc-text-secondary">
                    {formatDate(order.placed_at)} · {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Razorpay'}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-acc-text dark:text-white">{formatCurrency(order.total)}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

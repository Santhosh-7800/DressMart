import { formatCurrency } from '@/lib/utils';

interface OrderSummaryProps {
  itemCount: number;
  subtotal: number;
  discount: number;
  couponDiscount?: number;
  pointsDiscount?: number;
  shippingFee: number;
  tax: number;
  total: number;
  children?: React.ReactNode;
}

export function OrderSummary({ itemCount, subtotal, discount, couponDiscount = 0, pointsDiscount = 0, shippingFee, tax, total, children }: OrderSummaryProps) {
  return (
    <div className="card-surface p-5">
      <h3 className="mb-4 font-semibold text-primary-400">PRICE DETAILS ({itemCount} {itemCount === 1 ? 'item' : 'items'})</h3>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-primary-500">Total MRP</span>
          <span>{formatCurrency(subtotal + discount)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Discount on MRP</span>
            <span>−{formatCurrency(discount)}</span>
          </div>
        )}
        {couponDiscount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Coupon Discount</span>
            <span>−{formatCurrency(couponDiscount)}</span>
          </div>
        )}
        {pointsDiscount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Reward Points Redeemed</span>
            <span>−{formatCurrency(pointsDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-primary-500">Delivery Charges</span>
          <span className={shippingFee === 0 ? 'text-emerald-600' : ''}>{shippingFee === 0 ? 'FREE' : formatCurrency(shippingFee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-primary-500">Tax (GST)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="my-1 border-t border-dashed border-primary-200 dark:border-primary-600" />
        <div className="flex justify-between text-base font-bold">
          <span>Total Amount</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

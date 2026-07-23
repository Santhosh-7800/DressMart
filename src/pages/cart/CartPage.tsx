import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useCart } from '@/hooks/useCart';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { CouponInput } from '@/components/cart/CouponInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import type { Coupon } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 79;
const TAX_RATE = 0.05;

export function CartPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { items, savedForLater, subtotal, totalDiscount, totalItems, hasOutOfStockItems, updateQuantity, removeItem, saveForLater } = useCart();
  const [coupon, setCoupon] = useState<Coupon | null>(null);

  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
  let couponDiscount = 0;
  if (coupon) {
    couponDiscount = coupon.discount_type === 'percent' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
    if (coupon.max_discount) couponDiscount = Math.min(couponDiscount, coupon.max_discount);
  }
  const taxableAmount = Math.max(subtotal - couponDiscount, 0);
  const tax = Math.round(taxableAmount * TAX_RATE);
  const total = Math.round(taxableAmount + tax + shippingFee);

  const handleCheckout = () => {
    if (hasOutOfStockItems) return;
    sessionStorage.setItem('dressmart:checkout-coupon', JSON.stringify(coupon));
    navigate(isAuthenticated ? '/checkout' : '/login', { state: { from: '/checkout' } });
  };

  if (items.length === 0 && savedForLater.length === 0) {
    return (
      <div className="container-app py-12">
        <Seo title="Cart" />
        <EmptyState icon={ShoppingCart} title="Your cart is empty" description="Looks like you haven't added anything yet." actionLabel="Start Shopping" actionHref="/" />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <Seo title="Cart" />
      <h1 className="mb-6 text-2xl font-bold">Shopping Cart</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {items.length > 0 ? (
            <div className="card-surface p-5">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={(quantity) => updateQuantity({ cartItemId: item.id, quantity })}
                    onRemove={() => removeItem(item.id)}
                    onSaveForLater={() => saveForLater({ cartItemId: item.id, saved: true })}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="card-surface p-8 text-center text-sm text-primary-400">Your cart is empty. Items saved for later are below.</div>
          )}

          {savedForLater.length > 0 && (
            <div className="card-surface mt-6 p-5">
              <h2 className="mb-3 font-semibold">Saved for Later ({savedForLater.length})</h2>
              <AnimatePresence initial={false}>
                {savedForLater.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={(quantity) => updateQuantity({ cartItemId: item.id, quantity })}
                    onRemove={() => removeItem(item.id)}
                    onMoveToCart={() => saveForLater({ cartItemId: item.id, saved: false })}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-4">
            <div className="card-surface p-4">
              <CouponInput appliedCoupon={coupon} onApply={setCoupon} onRemove={() => setCoupon(null)} orderValue={subtotal} />
            </div>
            <OrderSummary itemCount={totalItems} subtotal={subtotal} discount={totalDiscount} couponDiscount={couponDiscount} shippingFee={shippingFee} tax={tax} total={total}>
              {hasOutOfStockItems && (
                <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  Some items in your cart exceed available stock. Adjust quantities to continue.
                </p>
              )}
              <Button variant="accent" fullWidth size="lg" className="mt-4" onClick={handleCheckout} disabled={hasOutOfStockItems}>
                Proceed to Checkout
              </Button>
              <Link to="/" className="mt-2 block text-center text-sm text-accent-600 hover:underline">
                Continue Shopping
              </Link>
            </OrderSummary>
          </div>
        )}
      </div>
    </div>
  );
}

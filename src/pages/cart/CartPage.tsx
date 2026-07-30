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
import { clearBuyNowItem } from '@/lib/buyNowSession';
import { formatCurrency } from '@/lib/utils';

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
    // A leftover Buy Now session (started, then abandoned) must never hijack a normal cart checkout.
    clearBuyNowItem();
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
    <div className="container-app pt-8 pb-24 md:pb-8">
      <Seo title="Cart" />
      <h1 className="mb-6 hidden text-2xl font-bold md:block">Shopping Cart</h1>
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
              <Button variant="accent" fullWidth size="lg" className="mt-4 hidden md:block" onClick={handleCheckout} disabled={hasOutOfStockItems}>
                Proceed to Checkout
              </Button>
              <Link to="/" className="mt-2 block text-center text-sm text-accent-600 hover:underline">
                Continue Shopping
              </Link>
            </OrderSummary>
          </div>
        )}
      </div>

      {/* Mobile sticky checkout bar — the desktop button above is buried below the cart list on a
          single-column mobile layout; this keeps the primary action reachable without scrolling.
          bottom-nav-safe sits just above the global BottomNavBar (still visible on /cart),
          accounting for its safe-area-inset-bottom padding, not just its 64px base height. */}
      {items.length > 0 && (
        <div className="bottom-nav-safe fixed inset-x-0 z-30 border-t border-primary-100 bg-surface p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden dark:border-primary-700 dark:bg-surface-dark">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-primary-400">Total</p>
              <p className="truncate text-lg font-bold">{formatCurrency(total)}</p>
            </div>
            <Button variant="accent" size="md" onClick={handleCheckout} disabled={hasOutOfStockItems} className="shrink-0">
              Proceed to Checkout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

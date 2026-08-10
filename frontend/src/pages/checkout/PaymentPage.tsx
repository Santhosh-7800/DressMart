import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CreditCard, Banknote } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { Button } from '@/components/ui/Button';
import { useCheckoutItems } from '@/hooks/useCheckoutItems';
import { useAuth } from '@/contexts/AuthContext';
import { paymentService, loadRazorpayScript, type CartLineForOrder } from '@/services/paymentService';
import { env } from '@/lib/env';
import { clearBuyNowItem } from '@/lib/buyNowSession';
import { formatCurrency } from '@/lib/utils';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import type { Coupon, PaymentMethod } from '@/types';

const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 79;
const TAX_RATE = 0.05;

/** Minimal shape of the global injected by checkout.razorpay.com/v1/checkout.js — no official types package for it. */
interface RazorpayCheckoutInstance {
  open: () => void;
}
interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

export function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { addressId?: string; paymentMethod?: PaymentMethod } | null;
  const addressId = state?.addressId;
  const { user } = useAuth();
  const { items, subtotal, totalItems, isBuyNow } = useCheckoutItems();

  const [method, setMethod] = useState<PaymentMethod>(state?.paymentMethod ?? 'razorpay');
  const [isProcessing, setIsProcessing] = useState(false);
  // One id per mount of this page, reused across retries of the SAME checkout attempt — a
  // double-clicked "Place Order"/"Pay Now", or a client retry after a response was lost in
  // transit, resolves to the same server-side request instead of placing a second order. A fresh
  // navigation to /checkout/payment (a genuinely new checkout) re-mounts the page and gets a new id.
  const [clientRequestId] = useState(() => crypto.randomUUID());

  const coupon: Coupon | null = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('dressmart:checkout-coupon') ?? 'null');
    } catch {
      return null;
    }
  })();

  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  let couponDiscount = 0;
  if (coupon) {
    couponDiscount = coupon.discount_type === 'percent' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
    if (coupon.max_discount) couponDiscount = Math.min(couponDiscount, coupon.max_discount);
  }

  const taxableAmount = Math.max(subtotal - couponDiscount, 0);
  const tax = Math.round(taxableAmount * TAX_RATE);
  const total = Math.round(taxableAmount + tax + shippingFee);

  if (!addressId) {
    return (
      <div className="container-app py-12 text-center">
        <p className="text-sm text-primary-400">Please select a delivery address first.</p>
        <Button className="mt-4" onClick={() => navigate('/checkout')}>
          Back to Checkout
        </Button>
      </div>
    );
  }

  const cartPayload: CartLineForOrder[] = items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }));

  const goToSuccess = (result: { orderNumber: string; groupId: string }) => {
    sessionStorage.removeItem('dressmart:checkout-coupon');
    toast.success('Order placed successfully!');
    // Cart items: the Cloud Function already deleted the purchased docs server-side, and the cart's
    // realtime listener (useCart) reflects that on its own — nothing to invalidate client-side.
    // Buy Now never touched the cart at all; its temporary checkout session just needs clearing.
    if (isBuyNow) clearBuyNowItem();
    navigate(`/order-success/${result.groupId}`, { state: result });
  };

  const handlePlaceCodOrder = async () => {
    setIsProcessing(true);
    try {
      const result = await paymentService.placeCodOrder({ addressId, couponCode: coupon?.code, cart: cartPayload, clientRequestId });
      goToSuccess(result);
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Could not place order. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayWithRazorpay = async () => {
    setIsProcessing(true);
    try {
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error('Payment gateway failed to load. Please try again.');

      const razorpayOrder = await paymentService.createRazorpayOrder({ amount: total, receipt: `checkout-${Date.now()}` });

      const checkout = new window.Razorpay({
        key: razorpayOrder.keyId || env.razorpayKeyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        order_id: razorpayOrder.razorpayOrderId,
        name: 'DressMart',
        description: `Order payment (${totalItems} items)`,
        prefill: { name: user?.full_name, email: user?.email, contact: user?.phone ?? undefined },
        theme: { color: '#c026d3' },
        handler: async (response) => {
          try {
            const result = await paymentService.verifyAndPlaceOrder({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              addressId,
              couponCode: coupon?.code,
              cart: cartPayload,
              clientRequestId,
            });
            goToSuccess(result);
          } catch (error) {
            toast.error(getFriendlyErrorMessage(error, 'Payment verification failed.'));
          } finally {
            setIsProcessing(false);
          }
        },
        modal: { ondismiss: () => setIsProcessing(false) },
      });
      checkout.open();
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Payment failed. Please try again.'));
      setIsProcessing(false);
    }
  };

  const handlePlaceOrder = () => {
    if (method === 'cod') return handlePlaceCodOrder();
    return handlePayWithRazorpay();
  };

  return (
    <div className="container-app pt-8 pb-24 md:pb-8">
      <Seo title="Payment" />
      <h1 className="mb-6 hidden text-2xl font-bold md:block">Payment</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card-surface p-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMethod('razorpay')}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium ${method === 'razorpay' ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600'}`}
            >
              <CreditCard size={20} />
              Razorpay
            </button>
            <button
              onClick={() => setMethod('cod')}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium ${method === 'cod' ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600'}`}
            >
              <Banknote size={20} />
              Cash on Delivery
            </button>
          </div>

          <div className="mt-6">
            {method === 'razorpay' && (
              <p className="rounded-xl bg-primary-50 p-4 text-sm text-primary-500 dark:bg-primary-800">
                You'll be redirected to Razorpay's secure checkout to pay via UPI, card, netbanking or wallet.
              </p>
            )}
            {method === 'cod' && <p className="rounded-xl bg-primary-50 p-4 text-sm text-primary-500 dark:bg-primary-800">Pay in cash when your order is delivered. A small COD fee may apply.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <OrderSummary itemCount={totalItems} subtotal={subtotal} discount={0} couponDiscount={couponDiscount} shippingFee={shippingFee} tax={tax} total={total}>
            <Button variant="accent" fullWidth size="lg" className="mt-4 hidden md:block" onClick={handlePlaceOrder} isLoading={isProcessing}>
              {method === 'cod' ? 'Place Order' : 'Pay Now'}
            </Button>
          </OrderSummary>
        </div>
      </div>

      {/* Mobile sticky bar — BottomNavBar is already hidden on /checkout* routes (see MainLayout).
          pb-safe on the outer element adds clearance below the p-3 content rather than
          conflicting with it (see CheckoutPage's identical bar for the full explanation). */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-primary-100 bg-surface shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden dark:border-primary-700 dark:bg-surface-dark">
        <div className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-primary-400">Total</p>
            <p className="truncate text-lg font-bold">{formatCurrency(total)}</p>
          </div>
          <Button variant="accent" size="md" onClick={handlePlaceOrder} isLoading={isProcessing} className="shrink-0">
            {method === 'cod' ? 'Place Order' : 'Pay Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export interface CartLineForOrder {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CreateRazorpayOrderResult {
  razorpayOrderId: string;
  /** Paise, per Razorpay's API — a display-only boundary concern, not used for any app-level totals. */
  amount: number;
  currency: 'INR';
  keyId: string;
}

export interface PlaceOrderResult {
  orderNumber: string;
  groupId: string;
}

export interface VerifyAndPlaceOrderInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  addressId: string;
  couponCode?: string;
  cart: CartLineForOrder[];
}

export interface PlaceCodOrderInput {
  addressId: string;
  couponCode?: string;
  cart: CartLineForOrder[];
}

let razorpayScriptPromise: Promise<void> | null = null;

/** Injects the Razorpay Checkout script tag once and resolves once it has loaded (no-op if already present). */
export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script.'));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

export const paymentService = {
  /** Step 1 of the Razorpay flow — mints a Razorpay order server-side for the given rupee total. */
  async createRazorpayOrder(input: { amount: number; receipt: string }): Promise<CreateRazorpayOrderResult> {
    const call = httpsCallable<{ amount: number; receipt: string }, CreateRazorpayOrderResult>(functions, 'createRazorpayOrder');
    const res = await call(input);
    return res.data;
  },

  /** Step 2 — after the Razorpay Checkout modal succeeds, verifies the signature and actually places the order(s). */
  async verifyAndPlaceOrder(input: VerifyAndPlaceOrderInput): Promise<PlaceOrderResult> {
    const call = httpsCallable<VerifyAndPlaceOrderInput, PlaceOrderResult>(functions, 'verifyAndPlaceOrder');
    const res = await call(input);
    return res.data;
  },

  /** Cash on Delivery — places the order(s) directly, no payment gateway involved. */
  async placeCodOrder(input: PlaceCodOrderInput): Promise<PlaceOrderResult> {
    const call = httpsCallable<PlaceCodOrderInput, PlaceOrderResult>(functions, 'placeCodOrder');
    const res = await call(input);
    return res.data;
  },
};

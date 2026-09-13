import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { runCallable } from '../lib/callableGuard';
import { razorpayKeyId, razorpayKeySecret } from '../lib/config';
import { getRazorpayClient } from '../lib/razorpay';
import { getCartTotal, type CartLineInput } from '../lib/orderPlacement';

interface CreateRazorpayOrderData {
  addressId: string;
  couponCode?: string;
  cart: CartLineInput[];
  receipt: string;
}

interface CreateRazorpayOrderResult {
  razorpayOrderId: string;
  amount: number; // paise
  currency: 'INR';
  keyId: string;
}

export const createRazorpayOrder = onCall<CreateRazorpayOrderData>(
  { secrets: [razorpayKeySecret] },
  async (request): Promise<CreateRazorpayOrderResult> =>
    runCallable('Payment gateway is unavailable right now. Please try again or use Cash on Delivery.', async () => {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be signed in to start a payment.');
      }

      const { addressId, couponCode, cart, receipt } = request.data ?? ({} as CreateRazorpayOrderData);
      if (typeof receipt !== 'string' || !receipt) {
        throw new HttpsError('invalid-argument', 'receipt is required.');
      }

      // The amount charged is always computed here, server-side, from the buyer's own cart/
      // address/coupon — never taken from the client. This is the exact same pricing logic
      // verifyAndPlaceOrder's placeOrderInternal uses moments later to record the order, so what
      // Razorpay charges and what the order is billed for can never diverge.
      const amountRupees = await getCartTotal({ uid: request.auth.uid, addressId, couponCode, cart });

      const razorpay = getRazorpayClient();
      const order = await razorpay.orders.create({
        amount: Math.round(amountRupees * 100),
        currency: 'INR',
        receipt,
      });

      return {
        razorpayOrderId: order.id,
        amount: Number(order.amount),
        currency: 'INR',
        keyId: razorpayKeyId.value(),
      };
    }),
);

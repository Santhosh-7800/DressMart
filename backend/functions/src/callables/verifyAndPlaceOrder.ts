import { createHmac } from 'crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { runCallable } from '../lib/callableGuard';
import { razorpayKeySecret } from '../lib/config';
import { placeOrderInternal, type CartLineInput } from '../lib/orderPlacement';

interface VerifyAndPlaceOrderData {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  addressId: string;
  couponCode?: string;
  cart: CartLineInput[];
  clientRequestId?: string;
}

export const verifyAndPlaceOrder = onCall<VerifyAndPlaceOrderData>(
  { secrets: [razorpayKeySecret] },
  async (request) =>
    runCallable('Payment received, but we could not confirm your order. Please contact support before retrying payment.', async () => {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be signed in to place an order.');
      }

      const {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        addressId,
        couponCode,
        cart,
        clientRequestId,
      } = request.data ?? ({} as VerifyAndPlaceOrderData);

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new HttpsError('invalid-argument', 'Razorpay payment details are required.');
      }

      const expectedSignature = createHmac('sha256', razorpayKeySecret.value())
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        throw new HttpsError('invalid-argument', 'Payment verification failed');
      }

      return placeOrderInternal({
        uid: request.auth.uid,
        addressId,
        couponCode,
        cart,
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        razorpayOrderId,
        razorpayPaymentId,
        clientRequestId,
      });
    }),
);

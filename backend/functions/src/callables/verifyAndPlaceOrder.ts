import { createHmac, timingSafeEqual } from 'crypto';
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

      // Timing-safe comparison — a plain `!==` on a hex digest leaks how many leading characters
      // matched via response-time differences, a standard (if hard to exploit remotely) side
      // channel on any secret comparison. timingSafeEqual requires equal-length buffers, so the
      // length check must happen first — that length itself isn't secret (a valid signature's
      // length is always the same, sha256-hex is always 64 chars).
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const providedBuffer = Buffer.from(razorpaySignature, 'utf8');
      const signatureIsValid = expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);

      if (!signatureIsValid) {
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

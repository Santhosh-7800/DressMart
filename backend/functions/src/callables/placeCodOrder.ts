import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { runCallable } from '../lib/callableGuard';
import { placeOrderInternal, type CartLineInput } from '../lib/orderPlacement';

interface PlaceCodOrderData {
  addressId: string;
  couponCode?: string;
  cart: CartLineInput[];
  clientRequestId?: string;
}

export const placeCodOrder = onCall<PlaceCodOrderData>(async (request) =>
  runCallable('Unable to place your order right now. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to place an order.');
    }

    const { addressId, couponCode, cart, clientRequestId } = request.data ?? ({} as PlaceCodOrderData);

    return placeOrderInternal({
      uid: request.auth.uid,
      addressId,
      couponCode,
      cart,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      clientRequestId,
    });
  }),
);

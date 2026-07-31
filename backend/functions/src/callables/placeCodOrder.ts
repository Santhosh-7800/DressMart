import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { placeOrderInternal, type CartLineInput } from '../lib/orderPlacement';

interface PlaceCodOrderData {
  addressId: string;
  couponCode?: string;
  cart: CartLineInput[];
}

export const placeCodOrder = onCall<PlaceCodOrderData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to place an order.');
  }

  const { addressId, couponCode, cart } = request.data ?? ({} as PlaceCodOrderData);

  return placeOrderInternal({
    uid: request.auth.uid,
    addressId,
    couponCode,
    cart,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
  });
});

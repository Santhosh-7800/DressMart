/**
 * DressMart Cloud Functions entry point — see functions/README.md for the full contract
 * (payload/return shapes, required config/secrets, and local dev instructions).
 */

// Callables
export { createRazorpayOrder } from './callables/createRazorpayOrder';
export { placeCodOrder } from './callables/placeCodOrder';
export { verifyAndPlaceOrder } from './callables/verifyAndPlaceOrder';
export { cancelOrder } from './callables/cancelOrder';
export { reviewSellerRequest } from './callables/reviewSellerRequest';
export { suspendSellerAccount } from './callables/suspendSellerAccount';

// Firestore triggers
export { onOrderStatusChange } from './triggers/onOrderStatusChange';
export { onReturnStatusChange } from './triggers/onReturnStatusChange';
export { onExchangeStatusChange } from './triggers/onExchangeStatusChange';
export { onSellerRequestCreated } from './triggers/onSellerRequestCreated';
export { onNotificationCreated } from './triggers/onNotificationCreated';

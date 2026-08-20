/**
 * DressMart Cloud Functions entry point — see functions/README.md for the full contract
 * (payload/return shapes, required config/secrets, and local dev instructions).
 */

// Callables
export { analyzeClothingImage } from './callables/analyzeClothingImage';
export { createRazorpayOrder } from './callables/createRazorpayOrder';
export { placeCodOrder } from './callables/placeCodOrder';
export { verifyAndPlaceOrder } from './callables/verifyAndPlaceOrder';
export { cancelOrder } from './callables/cancelOrder';
export { reviewSellerRequest } from './callables/reviewSellerRequest';
export { suspendSellerAccount } from './callables/suspendSellerAccount';
export { addSeller } from './callables/addSeller';
export { createHeadSeller } from './callables/createHeadSeller';
export { resetSellerPassword } from './callables/resetSellerPassword';
export { removeSeller } from './callables/removeSeller';
export { addStaff } from './callables/addStaff';
export { removeStaff } from './callables/removeStaff';
export { resetStaffPassword } from './callables/resetStaffPassword';

// Firestore triggers
export { onOrderStatusChange } from './triggers/onOrderStatusChange';
export { onReturnStatusChange } from './triggers/onReturnStatusChange';
export { onExchangeStatusChange } from './triggers/onExchangeStatusChange';
export { onSellerRequestCreated } from './triggers/onSellerRequestCreated';
export { onNotificationCreated } from './triggers/onNotificationCreated';

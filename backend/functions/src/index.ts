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
export { createAdmin } from './callables/createAdmin';
export { addStaff } from './callables/addStaff';
export { removeStaff } from './callables/removeStaff';
export { resetStaffPassword } from './callables/resetStaffPassword';
export { addDeliveryStaff } from './callables/addDeliveryStaff';
export { removeDeliveryStaff } from './callables/removeDeliveryStaff';
export { resetDeliveryStaffPassword } from './callables/resetDeliveryStaffPassword';
export { assignDelivery } from './callables/assignDelivery';
export { updateDeliveryStatus } from './callables/updateDeliveryStatus';
export { adjustStock } from './callables/adjustStock';
export { broadcastPromotionalNotification } from './callables/broadcastPromotionalNotification';
export { submitReview } from './callables/submitReview';
export { deleteOwnAccount } from './callables/deleteOwnAccount';

// Firestore triggers
export { onOrderStatusChange } from './triggers/onOrderStatusChange';
export { onReturnStatusChange } from './triggers/onReturnStatusChange';
export { onExchangeStatusChange } from './triggers/onExchangeStatusChange';
export { onNotificationCreated } from './triggers/onNotificationCreated';
export { onReviewWritten } from './triggers/onReviewWritten';
export { onSupportTicketCreated } from './triggers/onSupportTicketCreated';
export { onSupportMessageCreated } from './triggers/onSupportMessageCreated';
export { onSupportTicketStatusChange } from './triggers/onSupportTicketStatusChange';

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import type { Profile, SellerRequest } from '../lib/types';

interface ReviewSellerRequestData {
  requestId: string;
  approve: boolean;
  rejectionReason?: string;
}

export const reviewSellerRequest = onCall<ReviewSellerRequestData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { requestId, approve, rejectionReason } = request.data ?? ({} as ReviewSellerRequestData);
  if (!requestId || typeof approve !== 'boolean') {
    throw new HttpsError('invalid-argument', 'requestId and approve are required.');
  }

  const reviewerSnap = await db.collection('users').doc(request.auth.uid).get();
  const reviewer = reviewerSnap.data() as Profile | undefined;
  if (!reviewer || reviewer.role !== 'head_seller') {
    throw new HttpsError('permission-denied', 'Only the Head Seller can review seller applications.');
  }

  const requestRef = db.collection('seller_requests').doc(requestId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    throw new HttpsError('not-found', 'Seller request not found.');
  }
  const sellerRequest = requestSnap.data() as SellerRequest;

  const nowIso = new Date().toISOString();
  const status = approve ? 'approved' : 'rejected';
  const reason = approve ? null : rejectionReason ?? null;

  const batch = db.batch();
  batch.update(requestRef, {
    status,
    reviewed_at: nowIso,
    reviewed_by: request.auth.uid,
    rejection_reason: reason,
  });
  // role stays 'seller' either way — only seller_status gates what a rejected/pending applicant can do.
  batch.update(db.collection('users').doc(sellerRequest.user_id), {
    seller_status: status,
    seller_approved_at: approve ? nowIso : null,
    seller_status_reason: reason,
  });
  await batch.commit();

  await createNotification({
    userId: sellerRequest.user_id,
    title: approve ? 'Seller application approved' : 'Seller application rejected',
    message: approve
      ? 'Congratulations! Your seller application was approved — you can now list products on DressMart.'
      : `Your seller application was rejected.${reason ? ` Reason: ${reason}` : ''}`,
    type: 'seller_registration',
    link: '/seller/dashboard',
  });

  return { success: true };
});

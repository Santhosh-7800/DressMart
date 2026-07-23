import type { DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import type { Profile } from '../lib/types';

interface SuspendSellerAccountData {
  sellerId: string;
  reason: string;
  suspend: boolean;
}

const BATCH_CHUNK_SIZE = 400; // stay comfortably under Firestore's 500-write batch limit

async function deactivateProductsInChunks(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_CHUNK_SIZE) {
    const batch = db.batch();
    refs.slice(i, i + BATCH_CHUNK_SIZE).forEach((ref) => batch.update(ref, { is_active: false }));
    await batch.commit();
  }
}

export const suspendSellerAccount = onCall<SuspendSellerAccountData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { sellerId, reason, suspend } = request.data ?? ({} as SuspendSellerAccountData);
  if (!sellerId || typeof suspend !== 'boolean') {
    throw new HttpsError('invalid-argument', 'sellerId and suspend are required.');
  }

  const reviewerSnap = await db.collection('users').doc(request.auth.uid).get();
  const reviewer = reviewerSnap.data() as Profile | undefined;
  if (!reviewer || reviewer.role !== 'head_seller') {
    throw new HttpsError('permission-denied', 'Only the Head Seller can suspend seller accounts.');
  }

  await db.collection('users').doc(sellerId).update({
    seller_status: suspend ? 'suspended' : 'approved',
    seller_status_reason: suspend ? reason ?? null : null,
  });

  if (suspend) {
    const productsSnap = await db.collection('products').where('seller_id', '==', sellerId).get();
    if (!productsSnap.empty) {
      await deactivateProductsInChunks(productsSnap.docs.map((d) => d.ref));
    }
  }

  await createNotification({
    userId: sellerId,
    title: suspend ? 'Your seller account has been suspended' : 'Your seller account has been reinstated',
    message: suspend
      ? `Your seller account was suspended.${reason ? ` Reason: ${reason}` : ''}`
      : 'Your seller account is active again — you can resume selling.',
    type: 'platform',
    link: '/seller/dashboard',
  });

  return { success: true };
});

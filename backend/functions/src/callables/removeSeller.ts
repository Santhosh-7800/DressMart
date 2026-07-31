import type { DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';
import type { Profile } from '../lib/types';

interface RemoveSellerData {
  sellerId: string;
}

const BATCH_CHUNK_SIZE = 400; // stay comfortably under Firestore's 500-write batch limit

async function deleteRefsInChunks(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_CHUNK_SIZE) {
    const batch = db.batch();
    refs.slice(i, i + BATCH_CHUNK_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Head-Seller-only hard delete. Orders are financial/audit records and are never deleted by this
 * app anywhere else, so this refuses outright if the seller has any order history — the Head Seller
 * should use Suspend instead to preserve those records. Otherwise deletes the seller's products +
 * inventory docs, then the Auth account and profile doc.
 */
export const removeSeller = onCall<RemoveSellerData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { sellerId } = request.data ?? ({} as RemoveSellerData);
  if (!sellerId) {
    throw new HttpsError('invalid-argument', 'sellerId is required.');
  }
  if (sellerId === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot remove your own account.');
  }

  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data() as Profile | undefined;
  if (!caller || caller.role !== 'head_seller') {
    throw new HttpsError('permission-denied', 'Only the Head Seller can remove sellers.');
  }

  const targetSnap = await db.collection('users').doc(sellerId).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Seller not found.');
  }
  if ((targetSnap.data() as Profile).role === 'head_seller') {
    throw new HttpsError('failed-precondition', 'Cannot remove a Head Seller account this way.');
  }

  const ordersSnap = await db.collection('orders').where('seller_id', '==', sellerId).limit(1).get();
  if (!ordersSnap.empty) {
    throw new HttpsError(
      'failed-precondition',
      'This seller has order history and cannot be permanently removed — use Suspend instead to preserve records.',
    );
  }

  const productsSnap = await db.collection('products').where('seller_id', '==', sellerId).get();
  const productRefs = productsSnap.docs.map((d) => d.ref);
  const inventoryRefs = productRefs.map((r) => db.collection('inventory').doc(r.id));
  await deleteRefsInChunks([...productRefs, ...inventoryRefs]);

  await auth.deleteUser(sellerId);
  await db.collection('users').doc(sellerId).delete();

  return { success: true };
});

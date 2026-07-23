import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { Profile, SellerRequest } from '@/types';
import { SELLER_ROLES } from '@/lib/roles';

/**
 * Head-Seller-only reads/actions over the seller roster and applications. Cross-document writes
 * (approve/reject an application, suspend/reactivate a seller) go through Cloud Functions so the
 * `seller_requests` doc and the applicant's `users/{uid}` profile can never drift out of sync —
 * see the Cloud Functions contract in the task brief (functions/src/reviewSellerRequest, suspendSellerAccount).
 */
export const sellerAdminService = {
  /** Every seller application, newest first — the Head Seller filters by status client-side (tabs). */
  async listSellerRequests(): Promise<SellerRequest[]> {
    const snap = await getDocs(query(collection(db, 'seller_requests'), orderBy('applied_at', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SellerRequest);
  },

  /** Full seller roster (regular sellers + the Head Seller) for the Sellers page and platform dashboard counts. */
  async listSellers(): Promise<Profile[]> {
    const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', SELLER_ROLES)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Profile);
  },

  /** Approves or rejects a pending seller application. Atomically flips seller_requests + users/{uid}. */
  async reviewSellerRequest(input: { requestId: string; approve: boolean; rejectionReason?: string }): Promise<void> {
    const call = httpsCallable<{ requestId: string; approve: boolean; rejectionReason?: string }, { success: true }>(
      functions,
      'reviewSellerRequest',
    );
    await call(input);
  },

  /** Suspends (or reactivates) an approved seller's account. */
  async suspendSellerAccount(input: { sellerId: string; reason: string; suspend: boolean }): Promise<void> {
    const call = httpsCallable<{ sellerId: string; reason: string; suspend: boolean }, { success: true }>(
      functions,
      'suspendSellerAccount',
    );
    await call(input);
  },
};

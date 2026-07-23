import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import type { SellerRequest } from '../lib/types';

export const onSellerRequestCreated = onDocumentCreated('seller_requests/{requestId}', async (event) => {
  const sellerRequest = event.data?.data() as SellerRequest | undefined;
  if (!sellerRequest) return;

  const headSellerSnap = await db.collection('users').where('role', '==', 'head_seller').limit(1).get();
  if (headSellerSnap.empty) return;
  const headSeller = headSellerSnap.docs[0];

  await createNotification({
    userId: headSeller.id,
    title: 'New seller application',
    message: `${sellerRequest.store_name} (${sellerRequest.full_name}) applied to become a seller.`,
    type: 'seller_registration',
    link: `/head-seller/sellers/${event.params.requestId}`,
  });
});

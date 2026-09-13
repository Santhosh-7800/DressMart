import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Profile } from '@/types';
import { ADMIN_ROLE } from '@/lib/roles';

/** Admin-only reads over the store's own account and the customer directory. */
export const adminService = {
  /** The single Admin account, as a one-item list — kept in this shape (rather than a plain
   *  `getAdmin()`) so callers built around "the seller roster" (e.g. a report's seller-name
   *  lookup map) keep working unchanged now that there's only ever one row in it. */
  async listSellers(): Promise<Profile[]> {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', ADMIN_ROLE)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Profile);
  },

  /** Read-only customer (buyer) directory for the Admin's Customers page. */
  async listCustomers(): Promise<Profile[]> {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'buyer')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Profile);
  },
};

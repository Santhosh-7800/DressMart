import { collection, addDoc, deleteDoc, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Address } from '@/types';

const ADDRESSES_COLLECTION = 'addresses';

async function unsetOtherDefaults(userId: string, keepAddressId?: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, ADDRESSES_COLLECTION), where('user_id', '==', userId), where('is_default', '==', true)),
  );
  const toClear = snap.docs.filter((d) => d.id !== keepAddressId);
  if (toClear.length === 0) return;
  const batch = writeBatch(db);
  toClear.forEach((d) => batch.update(d.ref, { is_default: false }));
  await batch.commit();
}

export const addressService = {
  async list(userId: string): Promise<Address[]> {
    const snap = await getDocs(query(collection(db, ADDRESSES_COLLECTION), where('user_id', '==', userId)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Address);
    return items.sort((a, b) => Number(b.is_default) - Number(a.is_default));
  },

  async add(userId: string, address: Omit<Address, 'id' | 'user_id'>): Promise<Address[]> {
    const existing = await this.list(userId);
    const isDefault = address.is_default || existing.length === 0;
    if (isDefault) await unsetOtherDefaults(userId);
    await addDoc(collection(db, ADDRESSES_COLLECTION), { ...address, user_id: userId, is_default: isDefault });
    return this.list(userId);
  },

  async update(userId: string, addressId: string, updates: Partial<Address>): Promise<Address[]> {
    if (updates.is_default) await unsetOtherDefaults(userId, addressId);
    const { id: _id, user_id: _userId, ...safeUpdates } = updates;
    await updateDoc(doc(db, ADDRESSES_COLLECTION, addressId), safeUpdates);
    return this.list(userId);
  },

  async remove(userId: string, addressId: string): Promise<Address[]> {
    await deleteDoc(doc(db, ADDRESSES_COLLECTION, addressId));
    return this.list(userId);
  },
};

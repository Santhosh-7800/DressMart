import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * Product image upload — path is scoped by the owning seller's uid (`products/{sellerId}/...`)
 * to match storage.rules, which only allows that seller to write under their own prefix.
 */
export async function uploadProductImage(file: File, sellerId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `products/${sellerId}/${crypto.randomUUID()}.${ext}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { cacheControl: '3600' });
  return getDownloadURL(fileRef);
}

export async function uploadProductImages(files: File[], sellerId: string): Promise<string[]> {
  return Promise.all(files.map((file) => uploadProductImage(file, sellerId)));
}

/** Profile photo upload — `avatars/{userId}/...`, matching storage.rules. Each upload gets a fresh path (no upsert-in-place) so a browser/CDN cache never serves a stale photo at the same URL. */
export async function uploadAvatarImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `avatars/${userId}/avatar-${Date.now()}.${ext}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { cacheControl: '3600' });
  return getDownloadURL(fileRef);
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

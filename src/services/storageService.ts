import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';

/**
 * Product image upload. Live mode uploads to the `product-images` Supabase Storage bucket (public
 * read, admin/shop_owner write — see migration 0017) and returns its public URL. Mock mode has no
 * real backend to upload to, so it creates an object URL — which is a real, renderable image URL
 * for the lifetime of this tab/session (until the page fully reloads), enough to demonstrate
 * "upload a product image and see it live in the customer app" end to end.
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (env.useMockData) {
    return URL.createObjectURL(file);
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `products/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProductImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(uploadProductImage));
}

/**
 * Profile photo upload — the `avatars` bucket (migration 0004) is public-read, and its
 * insert/update policies require the object's first path segment to equal `auth.uid()`, hence
 * `${userId}/...` below. `upsert: true` so re-uploading a new photo replaces the old file at the
 * same path instead of accumulating orphaned objects.
 */
export async function uploadAvatarImage(file: File, userId: string): Promise<string> {
  if (env.useMockData) {
    return URL.createObjectURL(file);
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function isAcceptedImageFile(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

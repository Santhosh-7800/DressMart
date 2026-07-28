/**
 * Client-side avatar processing — center-crops to a square (cover-fit, so a non-square source
 * photo isn't squashed) and downscales to `size`x`size`, then re-encodes as a compressed JPEG.
 * Runs before every avatar upload (see useAvatar.ts) so profile photos never ship the browser's
 * arbitrarily-large original file.
 */
export async function resizeAndCompressImage(file: File | Blob, size = 512, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const sourceSize = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - sourceSize) / 2;
    const sourceY = (bitmap.height - sourceSize) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process this image in your browser.');
    ctx.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('Could not process this image in your browser.');
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Downscales to at most `maxWidth`, preserving aspect ratio (no center-crop) — used for wide assets
 * like a shop/homepage banner, where resizeAndCompressImage's square crop would mangle the image.
 */
export async function resizeAndCompressImageToWidth(file: File | Blob, maxWidth = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process this image in your browser.');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('Could not process this image in your browser.');
    return blob;
  } finally {
    bitmap.close();
  }
}

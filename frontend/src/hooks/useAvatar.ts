import { useState } from 'react';
import { useProfile } from './useProfile';
import { uploadAvatarImage, isAcceptedImageFile } from '@/services/storageService';
import { resizeAndCompressImage } from '@/lib/imageProcessing';

const MAX_SIZE_MB = 5;

/**
 * The single reusable hook for reading/uploading the current user's avatar — every page that shows
 * or edits the profile photo (Navbar, Profile, My Account) should use this instead of touching
 * `avatar_url`/storageService directly. Resizes to 512x512 and compresses before uploading, exactly
 * like `useProfile`'s `updateProfile`, so the new photo appears instantly wherever it's shown.
 */
export function useAvatar() {
  const { profile, updateProfile } = useProfile();
  const [isProcessing, setIsProcessing] = useState(false);

  const avatarUrl = profile?.avatar_url ?? null;
  const initials = profile?.full_name?.trim() ? profile.full_name.trim().charAt(0).toUpperCase() : '?';

  const uploadAvatar = async (file: File) => {
    if (!profile) throw new Error('You must be signed in to update your profile photo.');
    if (!isAcceptedImageFile(file)) throw new Error('Only JPG, PNG, or WEBP images are supported.');
    if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`Image must be smaller than ${MAX_SIZE_MB}MB.`);

    setIsProcessing(true);
    try {
      const processedBlob = await resizeAndCompressImage(file, 512, 0.85);
      const processedFile = new File([processedBlob], 'profile.jpg', { type: 'image/jpeg' });
      const url = await uploadAvatarImage(processedFile, profile.id);
      await updateProfile({ avatar_url: url });
      return url;
    } finally {
      setIsProcessing(false);
    }
  };

  return { avatarUrl, initials, uploadAvatar, isUploading: isProcessing };
}

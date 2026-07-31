import { useCallback, useEffect, useState } from 'react';

const MAX_SIZE_MB = 8;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UseImageUploadResult {
  imageUrl: string | null;
  error: string | null;
  isDragging: boolean;
  setFile: (file: File | null) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  reset: () => void;
}

/** Manages a single user-uploaded photo as an object URL, with validation and cleanup. */
export function useImageUpload(): UseImageUploadResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const setFile = useCallback((file: File | null) => {
    setError(null);
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) setFile(file);
    },
    [setFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const reset = useCallback(() => {
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError(null);
  }, []);

  return { imageUrl, error, isDragging, setFile, handleDrop, handleDragOver, handleDragLeave, reset };
}

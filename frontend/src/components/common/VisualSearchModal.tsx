import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { validateImageFile, visualSearchService } from '@/services/visualSearchService';
import type { DetectedClothingAttributes } from '@/types';

export interface VisualSearchResult {
  attrs: DetectedClothingAttributes;
  previewDataUrl: string;
  categorySlugs: string[];
}

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called once analysis + category matching succeed; the modal never navigates itself. */
  onAnalyzed: (result: VisualSearchResult) => void;
}

type Status = 'idle' | 'uploading' | 'analyzing' | 'matching';

const STATUS_LABEL: Record<Exclude<Status, 'idle'>, string> = {
  uploading: 'Uploading image...',
  analyzing: 'Analyzing clothing...',
  matching: 'Finding matching products...',
};

function friendlyErrorMessage(err: unknown): string {
  // Every error this flow can throw (file validation, image decode, and the Cloud Function's own
  // HttpsError — see analyzeClothingImage.ts / callableGuard.ts) already carries a customer-safe
  // message by this codebase's convention; a message-less/unexpected error still falls back to a
  // generic, non-technical string rather than ever surfacing raw Firebase/network internals.
  if (err instanceof Error && err.message) return err.message;
  return "Unable to analyze this image. Please try another photo.";
}

/**
 * "DressMart AI Visual Search" entry point — mirrors BarcodeScannerModal's shape (isOpen/onClose,
 * the modal itself never navigates) but drives the analyzeClothingImage flow instead of a barcode
 * decode: pick/take a photo -> compress + send to the Cloud Function -> resolve relevant category
 * slugs -> hand the result back to the caller, which commits search history and navigates.
 */
export function VisualSearchModal({ isOpen, onClose, onAnalyzed }: VisualSearchModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      cancelledRef.current = false;
      setStatus('idle');
      setPreviewUrl(null);
      setErrorMessage(null);
    } else {
      cancelledRef.current = true;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleClose = () => {
    cancelledRef.current = true;
    onClose();
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setErrorMessage(validationError.message);
      return;
    }

    setErrorMessage(null);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus('uploading');
    // Purely cosmetic staging — the network call below is one round trip, but showing "Analyzing"
    // only once it's actually likely underway (rather than the instant it's fired) reads truer to
    // what's happening than jumping straight to it.
    const analyzingTimer = setTimeout(() => {
      if (!cancelledRef.current) setStatus('analyzing');
    }, 400);

    try {
      const { attrs, previewDataUrl } = await visualSearchService.analyzeImage(file);
      clearTimeout(analyzingTimer);
      if (cancelledRef.current) return;
      setStatus('matching');
      const categorySlugs = await visualSearchService.getRelevantCategorySlugs(attrs);
      if (cancelledRef.current) return;
      onAnalyzed({ attrs, previewDataUrl, categorySlugs });
    } catch (err) {
      clearTimeout(analyzingTimer);
      if (cancelledRef.current) return;
      setStatus('idle');
      setPreviewUrl(null);
      setErrorMessage(friendlyErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Search by Photo" className="max-w-md">
      <div className="space-y-4">
        {status === 'idle' ? (
          <>
            <p className="text-sm text-primary-500 dark:text-primary-300">
              Take or upload a photo of a clothing item and we'll find similar products at DressMart.
            </p>
            {errorMessage && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{errorMessage}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="btn-outline flex flex-col items-center gap-2 !py-6"
              >
                <Camera size={22} />
                Take Photo
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="btn-outline flex flex-col items-center gap-2 !py-6"
              >
                <ImageIcon size={22} />
                Upload / Choose Image
              </button>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full text-center text-sm font-medium text-primary-400 hover:text-primary-600 dark:hover:text-primary-200"
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="space-y-4">
            {previewUrl && (
              <div className="mx-auto aspect-square w-40 overflow-hidden rounded-2xl bg-primary-50 dark:bg-primary-800">
                <img src={previewUrl} alt="Selected clothing item" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-300">
              <Loader2 size={16} className="animate-spin" />
              {STATUS_LABEL[status]}
            </div>
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFileSelected(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            void handleFileSelected(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </Modal>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { BrowserMultiFormatReader as BrowserMultiFormatReaderType, IScannerControls } from '@zxing/browser';
import { ScanLine } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the decoded/typed code; the modal itself doesn't navigate or search. */
  onScan: (code: string) => void;
}

/**
 * Web camera barcode/QR scanner (native Android instead uses scanBarcodeNative() — see
 * SearchBar.tsx). Built on @zxing/browser, lazy-loaded by the caller via dynamic import so its
 * ~decoder code never lands in the main bundle. Always offers a manual code entry field alongside
 * the camera preview — covers browsers/devices with no camera, camera permission denied, or a
 * damaged/unreadable barcode.
 */
export function BarcodeScannerModal({ isOpen, onClose, onScan }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;

    setCameraError(null);
    let cancelled = false;

    import('@zxing/browser').then(({ BrowserMultiFormatReader }: { BrowserMultiFormatReader: typeof BrowserMultiFormatReaderType }) => {
      if (cancelled || !videoRef.current) return;
      const reader = new BrowserMultiFormatReader();

      reader
        .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current, (result) => {
          // The callback also fires on every frame with no result while a code just isn't in view
          // yet (that's normal, not an error) — only a successful decode matters here.
          if (result) onScan(result.getText());
        })
        .then((controls) => {
          if (cancelled) controls.stop();
          else controlsRef.current = controls;
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const name = err instanceof Error ? err.name : '';
          setCameraError(
            name === 'NotAllowedError'
              ? 'Camera access was denied. Allow camera access in your browser, or enter the code below.'
              : 'Could not access a camera. Enter the code below instead.',
          );
        });
    });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isOpen, onScan]);

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) onScan(manualCode.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan Barcode">
      <div className="space-y-4">
        {cameraError ? (
          <p className="rounded-xl bg-primary-50 p-3 text-sm text-primary-600 dark:bg-primary-800 dark:text-primary-300">{cameraError}</p>
        ) : (
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Camera preview for barcode scanning" />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-accent" />
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="flex items-end gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="e.g. product SKU"
            label="Or type the barcode / SKU"
            leftIcon={<ScanLine size={16} />}
            aria-label="Enter barcode manually"
          />
          <button type="submit" aria-label="Search entered barcode" className="btn-accent shrink-0" disabled={!manualCode.trim()}>
            Search
          </button>
        </form>
      </div>
    </Modal>
  );
}

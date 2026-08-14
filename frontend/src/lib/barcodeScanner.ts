import { Capacitor } from '@capacitor/core';

/**
 * Native scan via @capacitor-mlkit/barcode-scanning (Google Play Services' on-device scanner UI)
 * when running in the Capacitor Android shell. Dynamically imported so the plugin's native bridge
 * code never ships in the web bundle — same pattern as initCapacitorNative() in capacitorNative.ts.
 *
 * Returns null on the web, or if the module/camera isn't available — callers should fall back to
 * the web camera modal (see BarcodeScannerModal.tsx) in that case rather than treating it as fatal.
 */
export async function scanBarcodeNative(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

  const { supported } = await BarcodeScanner.isSupported();
  if (!supported) return null;

  const { camera } = await BarcodeScanner.checkPermissions();
  if (camera !== 'granted' && camera !== 'limited') {
    const requested = await BarcodeScanner.requestPermissions();
    if (requested.camera !== 'granted' && requested.camera !== 'limited') return null;
  }

  const { barcodes } = await BarcodeScanner.scan();
  return barcodes[0]?.rawValue ?? null;
}

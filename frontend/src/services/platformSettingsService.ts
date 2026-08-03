import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PlatformSettings } from '@/types';

/** Singleton doc id — see `PlatformSettings` in types/database.ts. */
const SETTINGS_DOC_ID = 'config';

const DEFAULT_SETTINGS: Omit<PlatformSettings, 'id'> = {
  store_name: 'DressMart',
  support_email: '',
  support_phone: '',
  gst_number: '',
  shipping_charge: 0,
  free_shipping_threshold: 999,
  return_window_days: 7,
  exchange_window_days: 7,
  return_policy: '',
  privacy_policy: '',
  commission_rate_percent: 0,
  updated_at: new Date().toISOString(),
};

export const platformSettingsService = {
  /** Reads `platform_settings/config`, falling back to sane defaults if the doc hasn't been created yet. */
  async get(): Promise<PlatformSettings> {
    const snap = await getDoc(doc(db, 'platform_settings', SETTINGS_DOC_ID));
    if (!snap.exists()) return { id: SETTINGS_DOC_ID, ...DEFAULT_SETTINGS };
    // Spread over DEFAULT_SETTINGS (not just the raw doc) so a doc saved before commission_rate_percent
    // existed still gets the safe 0 default instead of `undefined`.
    return { id: SETTINGS_DOC_ID, ...DEFAULT_SETTINGS, ...(snap.data() as Omit<PlatformSettings, 'id'>) };
  },

  /** Head-Seller-only write (see firestore.rules) — merges partial updates into the singleton doc. */
  async save(updates: Partial<Omit<PlatformSettings, 'id'>>): Promise<void> {
    await setDoc(
      doc(db, 'platform_settings', SETTINGS_DOC_ID),
      { ...updates, updated_at: new Date().toISOString() },
      { merge: true },
    );
  },
};

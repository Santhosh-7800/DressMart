import type { StaffDetails } from '@/types';
import { readStore, writeStore } from './mockStorage';

/** Mock mode's equivalent of the `staff` table (migration 0019) — shop_name/phone/status fields
 *  that live alongside the shared `profiles` row rather than on it. Keyed by profile id. */
const STAFF_DETAILS_KEY = 'staff-details';

const SEED_DETAILS: Record<string, StaffDetails> = {
  'user-staff-1': {
    id: 'user-staff-1',
    employee_id: 'DM-STF-000',
    shop_name: 'DressMart Koramangala',
    department: 'General',
    phone: '9876500002',
    status: 'active',
    language: 'en',
    notifications_enabled: true,
    theme: 'light',
    created_at: new Date().toISOString(),
  },
  'user-staff-rahul': {
    id: 'user-staff-rahul',
    employee_id: 'DM-STF-001',
    shop_name: 'DressMart Main Store',
    department: "Men's Wear",
    phone: '9876543210',
    status: 'active',
    language: 'en',
    notifications_enabled: true,
    theme: 'light',
    created_at: new Date().toISOString(),
  },
  'user-staff-priya': {
    id: 'user-staff-priya',
    employee_id: 'DM-STF-002',
    shop_name: 'DressMart Main Store',
    department: 'Kids Wear',
    phone: '9876543211',
    status: 'active',
    language: 'en',
    notifications_enabled: true,
    theme: 'light',
    created_at: new Date().toISOString(),
  },
  'user-staff-arjun': {
    id: 'user-staff-arjun',
    employee_id: 'DM-STF-003',
    shop_name: 'DressMart Main Store',
    department: 'Formal Wear',
    phone: '9876543212',
    status: 'active',
    language: 'en',
    notifications_enabled: true,
    theme: 'light',
    created_at: new Date().toISOString(),
  },
};

function getAllDetails(): Record<string, StaffDetails> {
  const existing = readStore<Record<string, StaffDetails>>(STAFF_DETAILS_KEY, {});
  const missing = Object.keys(SEED_DETAILS).filter((id) => !existing[id]);
  // Self-heal: a record saved before `language`/`notifications_enabled`/`theme` existed (e.g. from
  // an earlier session) would otherwise be missing them forever, since the block above only adds
  // whole new records, not new fields on existing ones.
  const needsHeal = Object.entries(existing).filter(([, d]) => d.language === undefined || d.notifications_enabled === undefined || d.theme === undefined);
  if (missing.length === 0 && needsHeal.length === 0) return existing;

  const healed = { ...existing };
  needsHeal.forEach(([id, d]) => {
    healed[id] = { ...d, language: d.language ?? 'en', notifications_enabled: d.notifications_enabled ?? true, theme: d.theme ?? 'light' };
  });
  missing.forEach((id) => {
    healed[id] = SEED_DETAILS[id];
  });
  writeStore(STAFF_DETAILS_KEY, healed);
  return healed;
}

export function getStaffDetails(staffId: string): StaffDetails | null {
  return getAllDetails()[staffId] ?? null;
}

export function getAllStaffDetails(): Record<string, StaffDetails> {
  return getAllDetails();
}

export function saveStaffDetails(details: StaffDetails): void {
  const all = getAllDetails();
  all[details.id] = details;
  writeStore(STAFF_DETAILS_KEY, all);
}

/** Called the first time a newly-promoted staff account needs a details row (e.g. Admin grants
 *  the staff role to an existing customer account, which has no shop_name yet). */
export function ensureStaffDetails(staffId: string): StaffDetails {
  const existing = getStaffDetails(staffId);
  if (existing) return existing;
  const created: StaffDetails = {
    id: staffId,
    employee_id: '',
    shop_name: '',
    department: '',
    phone: '',
    status: 'active',
    language: 'en',
    notifications_enabled: true,
    theme: 'light',
    created_at: new Date().toISOString(),
  };
  saveStaffDetails(created);
  return created;
}

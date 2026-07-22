/**
 * DressMart Staff Portal — provisions the 3 named staff accounts as real Supabase Auth users.
 *
 * Uses the Supabase Admin API (auth.admin.createUser) rather than hand-inserting rows into
 * auth.users — that's the officially supported way to create auth users outside the normal
 * sign-up flow, and unlike raw SQL it doesn't depend on auth.users' internal column shape staying
 * stable across Supabase versions. (Migration 0020's SQL-based seed does the same thing as a
 * fallback for anyone applying migrations without running this script — both are idempotent, so
 * running one or both, in either order, is safe.)
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   2. Run the SQL migrations in supabase/migrations/*.sql against your project first
 *      (this script assumes the `staff`/`products` schema from 0019/0020 already exists)
 *   3. npm run seed:staff
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SUPABASE_URL.includes('your-project-ref') || SERVICE_ROLE_KEY.includes('your-service-role-key')) {
  console.error(
    '\n✖ Missing Supabase credentials.\n' +
      '  Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file before running this script.\n' +
      '  (SUPABASE_SERVICE_ROLE_KEY is only used server-side here — never expose it to the client.)\n',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface StaffSeed {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  employeeId: string;
  department: string;
  shopName: string;
}

const STAFF_SEEDS: StaffSeed[] = [
  { email: 'staff1@dressmart.com', password: 'Staff@123', fullName: 'Rahul Kumar', phone: '9876543210', employeeId: 'DM-STF-001', department: "Men's Wear", shopName: 'DressMart Main Store' },
  { email: 'staff2@dressmart.com', password: 'Staff@123', fullName: 'Priya Sharma', phone: '9876543211', employeeId: 'DM-STF-002', department: 'Kids Wear', shopName: 'DressMart Main Store' },
  { email: 'staff3@dressmart.com', password: 'Staff@123', fullName: 'Arjun Reddy', phone: '9876543212', employeeId: 'DM-STF-003', department: 'Formal Wear', shopName: 'DressMart Main Store' },
];

/** No `admin.getUserByEmail()` exists in supabase-js — if createUser reports the email is already
 *  registered, the profiles row (created by the handle_new_user() trigger for the original
 *  sign-up) is the only other place to look up that user's id by email. */
async function findExistingUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

async function ensureAuthUser(seed: StaffSeed): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: seed.email,
    password: seed.password,
    email_confirm: true,
    user_metadata: { full_name: seed.fullName, phone: seed.phone },
  });

  if (!error && data.user) return data.user.id;

  const alreadyExists = error?.message?.toLowerCase().includes('already') ?? false;
  if (!alreadyExists) {
    throw new Error(`Failed to create auth user for ${seed.email}: ${error?.message}`);
  }

  const existingId = await findExistingUserIdByEmail(seed.email);
  if (!existingId) {
    throw new Error(`${seed.email} already exists in auth.users but no matching profiles row was found — cannot proceed.`);
  }
  console.log(`  · ${seed.email} already exists — reusing existing account (password left unchanged).`);
  return existingId;
}

async function main() {
  console.log('DressMart — provisioning Staff Portal accounts in Supabase Auth\n');

  for (const seed of STAFF_SEEDS) {
    console.log(`Creating ${seed.fullName} (${seed.email})...`);
    const userId = await ensureAuthUser(seed);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'staff', full_name: seed.fullName, phone: seed.phone })
      .eq('id', userId);
    if (profileError) throw new Error(`Failed to set profile role for ${seed.email}: ${profileError.message}`);

    const { error: staffError } = await supabase.from('staff').upsert(
      {
        id: userId,
        name: seed.fullName,
        email: seed.email,
        phone: seed.phone,
        shop_name: seed.shopName,
        department: seed.department,
        employee_id: seed.employeeId,
        role: 'staff',
        status: 'active',
      },
      { onConflict: 'id' },
    );
    if (staffError) throw new Error(`Failed to upsert staff row for ${seed.email}: ${staffError.message}`);

    console.log(`  ✓ ${seed.email} — role=staff, status=active, employee_id=${seed.employeeId}`);
  }

  console.log('\n✔ Done. All 3 staff accounts can now sign in at /staff/login with password Staff@123.');
}

main().catch((error) => {
  console.error('\n✖', error instanceof Error ? error.message : error);
  process.exit(1);
});

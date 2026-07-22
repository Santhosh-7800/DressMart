import type { Profile } from '@/types';
import { readStore, writeStore } from './mockStorage';
import { generateReferralCode } from '@/lib/utils';
import { getStaffDetails } from './mockStaffProfiles';

interface MockUserRecord extends Profile {
  password: string;
}

const USERS_KEY = 'mock-users';
const SESSION_KEY = 'mock-session';
const OTP_KEY = 'mock-otp';

function uniqueReferralCode(existing: MockUserRecord[], seedName: string): string {
  let code = generateReferralCode(seedName);
  while (existing.some((u) => u.referral_code === code)) {
    code = generateReferralCode(seedName);
  }
  return code;
}

const SEED_USERS: MockUserRecord[] = [
  {
    id: 'user-demo-1',
    email: 'demo@dressmart.com',
    full_name: 'Demo User',
    phone: '9876543210',
    avatar_url: null,
    role: 'customer',
    referral_code: 'DEMO2026',
    referred_by: null,
    password: 'password123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-admin-1',
    email: 'admin@dressmart.com',
    full_name: 'DressMart Admin',
    phone: '9876500000',
    avatar_url: null,
    role: 'admin',
    referral_code: 'ADMIN001',
    referred_by: null,
    password: 'Admin@123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-owner-1',
    email: 'owner@dressmart.com',
    full_name: 'Shop Owner',
    phone: '9876500001',
    avatar_url: null,
    role: 'shop_owner',
    referral_code: 'OWNER001',
    referred_by: null,
    password: 'owner12345',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-staff-1',
    email: 'staff@dressmart.com',
    full_name: 'Warehouse Staff',
    phone: '9876500002',
    avatar_url: null,
    role: 'staff',
    referral_code: 'STAFF001',
    referred_by: null,
    password: 'staff12345',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-staff-rahul',
    email: 'staff1@dressmart.com',
    full_name: 'Rahul Kumar',
    phone: '9876543210',
    avatar_url: null,
    role: 'staff',
    referral_code: 'STAFFRAH',
    referred_by: null,
    password: 'Staff@123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-staff-priya',
    email: 'staff2@dressmart.com',
    full_name: 'Priya Sharma',
    phone: '9876543211',
    avatar_url: null,
    role: 'staff',
    referral_code: 'STAFFPRI',
    referred_by: null,
    password: 'Staff@123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'user-staff-arjun',
    email: 'staff3@dressmart.com',
    full_name: 'Arjun Reddy',
    phone: '9876543212',
    avatar_url: null,
    role: 'staff',
    referral_code: 'STAFFARJ',
    referred_by: null,
    password: 'Staff@123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/** Additive so accounts introduced after a browser already has a `mock-users` array (e.g. the
 *  shop_owner/staff demo logins added alongside the admin panel) still get seeded in, instead of
 *  the whole seed being skipped forever once any one user exists. Also self-heals the admin
 *  account's password/role if an older seed (e.g. a previous "admin12345" password) is still
 *  sitting in localStorage from before the spec'd admin@dressmart.com / Admin@123 credentials. */
function seedDemoUser(): MockUserRecord[] {
  const existing = readStore<MockUserRecord[]>(USERS_KEY, []);
  const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));
  const missing = SEED_USERS.filter((u) => !existingEmails.has(u.email.toLowerCase()));

  let users = missing.length > 0 ? [...existing, ...missing] : existing;
  let changed = missing.length > 0;

  const adminSeed = SEED_USERS.find((u) => u.email === 'admin@dressmart.com')!;
  const adminIdx = users.findIndex((u) => u.email.toLowerCase() === 'admin@dressmart.com');
  if (adminIdx >= 0 && (users[adminIdx].password !== adminSeed.password || users[adminIdx].role !== 'admin')) {
    users = [...users];
    users[adminIdx] = { ...users[adminIdx], password: adminSeed.password, role: 'admin' };
    changed = true;
  }

  if (changed) writeStore(USERS_KEY, users);
  return users;
}

function getUsers(): MockUserRecord[] {
  return seedDemoUser();
}

function saveUsers(users: MockUserRecord[]): void {
  writeStore(USERS_KEY, users);
}

/** Every account that has ever signed up in this browser — the admin Customers/Staff pages and
 *  order/cart aggregation (every order-placer must have an account) read from this. */
export function getAllProfiles(): Profile[] {
  return getUsers().map(({ password: _password, ...profile }) => profile);
}

export function setUserRole(userId: string, role: Profile['role']): Profile {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('User not found.');
  users[idx] = { ...users[idx], role, updated_at: new Date().toISOString() };
  saveUsers(users);
  const { password: _password, ...profile } = users[idx];
  return profile;
}

export function findProfileByEmail(email: string): Profile | null {
  const match = getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!match) return null;
  const { password: _password, ...profile } = match;
  return profile;
}

export function getSession(): Profile | null {
  const cached = readStore<Profile | null>(SESSION_KEY, null);
  if (!cached) return null;
  if (cached.referral_code) return cached;

  // Self-heal sessions cached before this account had a referral_code (e.g. an older cached
  // session from before the referrals feature existed) — the Referrals page otherwise renders
  // a permanently blank code, since this snapshot is normally trusted as-is forever.
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === cached.id);
  if (idx === -1) return cached;
  if (!users[idx].referral_code) {
    users[idx] = { ...users[idx], referral_code: uniqueReferralCode(users, users[idx].full_name) };
    saveUsers(users);
  }
  const repaired: Profile = { ...cached, referral_code: users[idx].referral_code };
  setSession(repaired);
  return repaired;
}

function setSession(profile: Profile | null): void {
  writeStore(SESSION_KEY, profile);
}

export async function mockSignUp(input: { email: string; password: string; fullName: string; phone?: string; referralCode?: string }): Promise<Profile> {
  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const referrer = input.referralCode
    ? users.find((u) => u.referral_code.toLowerCase() === input.referralCode!.trim().toLowerCase())
    : undefined;

  const newUser: MockUserRecord = {
    id: `user-${Date.now()}`,
    email: input.email,
    full_name: input.fullName,
    phone: input.phone ?? null,
    avatar_url: null,
    role: 'customer',
    referral_code: uniqueReferralCode(users, input.fullName),
    referred_by: referrer?.id ?? null,
    password: input.password,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  saveUsers([...users, newUser]);
  const { password: _password, ...profile } = newUser;
  setSession(profile);
  return profile;
}

export function getProfileById(userId: string): Profile | null {
  const match = getUsers().find((u) => u.id === userId);
  if (!match) return null;
  const { password: _password, ...profile } = match;
  return profile;
}

export async function mockSignIn(email: string, password: string): Promise<Profile> {
  const users = getUsers();
  const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!match) {
    throw new Error('Invalid email or password.');
  }
  if (match.role === 'staff' && getStaffDetails(match.id)?.status === 'inactive') {
    throw new Error('Your staff account has been deactivated. Contact your administrator.');
  }
  const { password: _password, ...profile } = match;
  setSession(profile);
  return profile;
}

export async function mockSignOut(): Promise<void> {
  setSession(null);
}

/** Verifies a password without starting/ending a session — used by the "Change Password" flow,
 *  which must confirm the CURRENT password before accepting a new one. */
export function mockVerifyPassword(email: string, password: string): boolean {
  const users = getUsers();
  return users.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
}

export async function mockRequestPasswordReset(email: string): Promise<void> {
  const users = getUsers();
  if (!users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('No account found with this email.');
  }
  // In mock mode, resetting simply confirms the flow — the real service sends a Supabase recovery email.
}

export async function mockResetPassword(email: string, newPassword: string): Promise<void> {
  const users = getUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) throw new Error('No account found with this email.');
  users[idx] = { ...users[idx], password: newPassword, updated_at: new Date().toISOString() };
  saveUsers(users);
}

export async function mockSendOtp(phoneOrEmail: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  writeStore(OTP_KEY, { target: phoneOrEmail, code, expiresAt: Date.now() + 5 * 60 * 1000 });
  // Demo mode: OTP is echoed back so the UI can display "your code is X" — a real
  // deployment sends this via Supabase Phone Auth / an SMS provider instead.
  return code;
}

export async function mockVerifyOtp(phoneOrEmail: string, code: string): Promise<boolean> {
  const stored = readStore<{ target: string; code: string; expiresAt: number } | null>(OTP_KEY, null);
  if (!stored || stored.target !== phoneOrEmail) return false;
  if (Date.now() > stored.expiresAt) return false;
  return stored.code === code;
}

export async function mockUpdateProfile(userId: string, updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>): Promise<Profile> {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('User not found.');
  users[idx] = { ...users[idx], ...updates, updated_at: new Date().toISOString() };
  saveUsers(users);
  const { password: _password, ...profile } = users[idx];
  setSession(profile);
  return profile;
}

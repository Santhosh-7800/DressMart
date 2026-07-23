import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Profile } from '@/types';

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export type { ConfirmationResult };

let recaptchaVerifier: RecaptchaVerifier | null = null;

function docToProfile(id: string, data: Record<string, unknown>): Profile {
  return { id, ...data } as Profile;
}

/** Creates the `users/{uid}` profile doc on first sign-in (any provider); no-op if it already exists. */
async function ensureProfileDoc(fbUser: FirebaseUser, extra?: Partial<Pick<Profile, 'full_name' | 'phone'>>): Promise<Profile> {
  const ref = doc(db, 'users', fbUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return docToProfile(fbUser.uid, snap.data());

  const now = new Date().toISOString();
  const profile: Omit<Profile, 'id'> = {
    email: fbUser.email ?? '',
    full_name: extra?.full_name ?? fbUser.displayName ?? 'DressMart User',
    phone: extra?.phone ?? fbUser.phoneNumber ?? null,
    avatar_url: fbUser.photoURL ?? null,
    role: 'buyer',
    created_at: now,
    updated_at: now,
  };
  await setDoc(ref, profile);
  return { id: fbUser.uid, ...profile };
}

export const authService = {
  async fetchProfile(uid: string): Promise<Profile | null> {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return docToProfile(uid, snap.data());
  },

  async signUp(input: SignUpInput): Promise<Profile> {
    const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
    await updateFirebaseProfile(cred.user, { displayName: input.fullName });
    return ensureProfileDoc(cred.user, { full_name: input.fullName, phone: input.phone ?? null });
  },

  async signIn(email: string, password: string): Promise<Profile> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await ensureProfileDoc(cred.user);
    if (profile.seller_status === 'suspended') {
      await firebaseSignOut(auth);
      throw new Error('Your seller account has been suspended. Contact the Head Seller.');
    }
    return profile;
  },

  async signInWithGoogle(): Promise<Profile> {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    return ensureProfileDoc(cred.user);
  },

  /** Renders an invisible reCAPTCHA into `containerId` and sends an OTP to `phoneNumber` (E.164, e.g. +919876543210). */
  async sendPhoneOtp(phoneNumber: string, containerId: string): Promise<ConfirmationResult> {
    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
    }
    return signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
  },

  async confirmPhoneOtp(confirmationResult: ConfirmationResult, code: string): Promise<Profile> {
    const cred = await confirmationResult.confirm(code);
    return ensureProfileDoc(cred.user);
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  async requestPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  /** Completes the emailed reset-password link — `oobCode` comes from that link's `?oobCode=` query param. */
  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    await confirmPasswordReset(auth, oobCode, newPassword);
  },

  /** Re-authenticates with the current password before setting the new one — Firebase requires a recent login for `updatePassword`. */
  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No signed-in email/password account.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    await updatePassword(user, newPassword);
  },

  async updateProfile(uid: string, updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>): Promise<void> {
    await updateDoc(doc(db, 'users', uid), { ...updates, updated_at: serverTimestamp() });
  },

  /**
   * Marks the current user as a pending seller and opens a review request for the Head Seller.
   * The role/status flip to 'approved' happens only via the `reviewSellerRequest` Cloud Function —
   * never directly from the client — so applicant and reviewer state can't drift out of sync.
   */
  async applyToBecomeSeller(uid: string, input: { store_name: string; gst_number: string; full_name: string; email: string; phone: string }): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', uid), {
      role: 'seller',
      seller_status: 'pending',
      store_name: input.store_name,
      gst_number: input.gst_number,
      seller_applied_at: now,
      updated_at: now,
    });
    const { addDoc, collection } = await import('firebase/firestore');
    await addDoc(collection(db, 'seller_requests'), {
      user_id: uid,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      store_name: input.store_name,
      gst_number: input.gst_number,
      status: 'pending',
      applied_at: now,
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
    });
  },
};

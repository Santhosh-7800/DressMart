import { Capacitor } from '@capacitor/core';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { env } from '@/lib/env';
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

/** Stamps `last_login_at` on every successful sign-in (new or returning user, any provider) — see signIn()'s identical stamp for email/password. */
async function touchLastLogin(uid: string): Promise<string> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'users', uid), { last_login_at: now });
  return now;
}

/** True inside the native Capacitor shell, or a mobile browser — signInWithPopup() is unreliable in
 *  both (native WebViews commonly block it as a "disallowed_useragent"; mobile browsers give it a
 *  worse UX), so signInWithGoogle() uses signInWithRedirect() here instead. */
function isMobileSignIn(): boolean {
  return Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
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

  /** `rememberMe` (default true, matching every existing call site) picks between Firebase Auth's
   *  two web persistence modes — local (survives closing the browser, the SDK's own default) vs
   *  session-only (cleared when the tab/browser closes). Set right before signing in since
   *  Firebase applies whatever persistence was last configured to the resulting session. */
  async signIn(email: string, password: string, rememberMe = true): Promise<Profile> {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await ensureProfileDoc(cred.user);
    if (profile.seller_status === 'suspended') {
      await firebaseSignOut(auth);
      throw new Error('Your seller account has been suspended. Contact the Head Seller.');
    }
    if (profile.staff_status === 'disabled') {
      await firebaseSignOut(auth);
      throw new Error('Your staff account has been disabled. Contact the Head Seller.');
    }
    const last_login_at = await touchLastLogin(cred.user.uid);
    return { ...profile, last_login_at };
  },

  /**
   * `prompt: 'select_account'` forces Google's real account chooser (accounts.google.com) to list
   * every Google account currently signed into the browser every time — without it, Google may
   * silently reuse whichever account was last selected instead of showing the chooser.
   *
   * signInWithPopup() on desktop (resolves synchronously, so the caller gets the resulting Profile
   * back directly); signInWithRedirect() on mobile (see isMobileSignIn). The redirect path returns
   * `null` immediately — the browser navigates away to Google and back, so the actual sign-in is
   * completed by completeGoogleRedirectSignIn() once the app reloads.
   */
  async signInWithGoogle(): Promise<Profile | null> {
    // Google/Phone sign-in have no "remember me" control (that's email/password-only, see signIn()
    // above) — always persist locally so a returning user stays signed in across browser/app
    // restarts. Without this, the auth instance would silently keep whatever persistence mode a
    // *previous* sign-in call last set (e.g. an earlier "remember me" unchecked attempt), signing
    // this user out sooner than expected on next launch even though their Firestore data is untouched.
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    if (isMobileSignIn()) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    const cred = await signInWithPopup(auth, provider);
    const profile = await ensureProfileDoc(cred.user);
    const last_login_at = await touchLastLogin(cred.user.uid);
    return { ...profile, last_login_at };
  },

  /** Completes a signInWithGoogle() redirect (mobile only, in practice — see above) after the app
   *  relaunches. Resolves to `null` when there's no pending redirect to complete (the overwhelmingly
   *  common case — this is called unconditionally on every app mount, see AuthContext). */
  async completeGoogleRedirectSignIn(): Promise<Profile | null> {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    const profile = await ensureProfileDoc(result.user);
    const last_login_at = await touchLastLogin(result.user.uid);
    return { ...profile, last_login_at };
  },

  /** Renders an invisible reCAPTCHA into `containerId` and sends an OTP to `phoneNumber` (E.164, e.g. +919876543210). */
  async sendPhoneOtp(phoneNumber: string, containerId: string): Promise<ConfirmationResult> {
    // Same reasoning as signInWithGoogle() above — phone sign-in has no "remember me" control either.
    await setPersistence(auth, browserLocalPersistence);
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

  /** `handleCodeInApp: true` makes Firebase email a link straight to `url` (with `mode` &
   *  `oobCode` query params attached) instead of routing through Firebase's own hosted
   *  reset-password page — ResetPasswordPage reads `oobCode` off that query string. */
  async requestPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email, { url: `${env.siteUrl}/reset-password`, handleCodeInApp: true });
  },

  /** Validates a reset-password `oobCode` *before* showing the new-password form — catches an
   *  invalid/expired/already-used link immediately (Firebase throws auth/invalid-action-code or
   *  auth/expired-action-code) instead of only failing once the user has already typed a new
   *  password. Resolves to the email address the code was issued for. */
  async verifyPasswordResetCode(oobCode: string): Promise<string> {
    return verifyPasswordResetCode(auth, oobCode);
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

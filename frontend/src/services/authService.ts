import { Capacitor } from '@capacitor/core';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
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
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '@/lib/firebase';
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

/** True on a mobile *browser* (not the native app — that's handled separately in signInWithGoogle,
 *  via the native Google Sign-In plugin). signInWithPopup() gives a poor UX on a phone browser, so
 *  signInWithGoogle() uses signInWithRedirect() there instead. */
function isMobileSignIn(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

let googleSignInInitialized = false;

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
    if (profile.staff_status === 'disabled') {
      await firebaseSignOut(auth);
      throw new Error('Your staff account has been disabled. Contact the Admin.');
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
   * back directly); signInWithRedirect() on mobile web (see isMobileSignIn). The redirect path
   * returns `null` immediately — the browser navigates away to Google and back, so the actual
   * sign-in is completed by completeGoogleRedirectSignIn() once the app reloads.
   *
   * Inside the native Android app, neither of those is used at all — signInWithRedirect/Popup both
   * go through a browser tab and Firebase's own authDomain handler page, which reads as "leaving the
   * app" rather than the native "pick a Google account" bottom sheet every other Android app shows.
   * The native branch below uses @capgo/capacitor-social-login (Android's Credential Manager) to get
   * a real Google ID token without ever opening a browser, then exchanges it for a Firebase
   * credential the exact same way ensureProfileDoc()/touchLastLogin() already handle for every other
   * provider.
   */
  async signInWithGoogle(): Promise<Profile | null> {
    // Google/Phone sign-in have no "remember me" control (that's email/password-only, see signIn()
    // above) — always persist locally so a returning user stays signed in across browser/app
    // restarts. Without this, the auth instance would silently keep whatever persistence mode a
    // *previous* sign-in call last set (e.g. an earlier "remember me" unchecked attempt), signing
    // this user out sooner than expected on next launch even though their Firestore data is untouched.
    await setPersistence(auth, browserLocalPersistence);

    if (Capacitor.isNativePlatform()) {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      if (!googleSignInInitialized) {
        await SocialLogin.initialize({ google: { webClientId: env.googleWebClientId } });
        googleSignInInitialized = true;
      }
      const { result } = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
      // `result` is a GoogleLoginResponseOnline | GoogleLoginResponseOffline union — only the
      // "online" variant (the default, since no `offline: true` option is passed above) carries
      // `idToken`; narrow with an `in` check rather than asserting the type.
      const idToken = result && 'idToken' in result ? result.idToken : null;
      if (!idToken) return null; // user backed out of the native account picker — not an error
      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(auth, credential);
      const profile = await ensureProfileDoc(cred.user);
      const last_login_at = await touchLastLogin(cred.user.uid);
      return { ...profile, last_login_at };
    }

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

  /**
   * Self-service account deletion — buyer accounts only (see deleteOwnAccount.ts's docstring for
   * why admin/staff/delivery aren't handled here). Runs entirely server-side via the
   * Admin SDK, so no reauthentication is required first the way changeOwnPassword needs one — the
   * callable only trusts `request.auth.uid`, not anything the client asserts. Signs out locally
   * afterward since the Auth account no longer exists server-side by the time this resolves.
   */
  async deleteAccount(): Promise<void> {
    const call = httpsCallable<undefined, { success: true }>(functions, 'deleteOwnAccount');
    await call();
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
};

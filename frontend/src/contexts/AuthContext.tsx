import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import type { Profile } from '@/types';
import { authService, type SignUpInput } from '@/services/authService';
import { auth, db } from '@/lib/firebase';
import { getGuestId } from '@/lib/guestId';

interface AuthContextValue {
  user: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Effective identity used to namespace cart/wishlist — the real user id when signed in, else a stable guest id. */
  identityId: string;
  signUp: (input: SignUpInput) => Promise<Profile>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<Profile>;
  /** Returns `null` when this kicked off a signInWithRedirect (mobile) instead of a popup — the
   *  page is about to navigate away to Google, so there's no Profile to hand back yet. */
  signInWithGoogle: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    // Completes a signInWithRedirect() from the mobile Google Sign-In path (see
    // authService.signInWithGoogle) — a no-op resolving to nothing when there's no pending redirect,
    // which is the common case on every other mount (including all of desktop).
    authService.completeGoogleRedirectSignIn().catch(() => {});

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      unsubscribeProfile?.();
      if (!fbUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      // Realtime profile subscription — role/seller_status changes (e.g. Head Seller approving or
      // suspending a seller) take effect immediately, without the affected user needing to re-login.
      unsubscribeProfile = onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
        setUser(snap.exists() ? ({ id: fbUser.uid, ...snap.data() } as Profile) : null);
        setIsLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const profile = await authService.signUp(input);
    toast.success(`Welcome to DressMart, ${profile.full_name.split(' ')[0]}!`);
    return profile;
  }, []);

  const signIn = useCallback(async (email: string, password: string, rememberMe = true) => {
    const profile = await authService.signIn(email, password, rememberMe);
    toast.success(`Welcome back, ${profile.full_name.split(' ')[0]}!`);
    return profile;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const profile = await authService.signInWithGoogle();
    if (profile) toast.success(`Welcome, ${profile.full_name.split(' ')[0]}!`);
    return profile;
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    toast('Signed out', { icon: '👋' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      identityId: user?.id ?? getGuestId(),
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
    }),
    [user, isLoading, signUp, signIn, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

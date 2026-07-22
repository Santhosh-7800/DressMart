import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { Profile } from '@/types';
import { authService, type SignUpInput } from '@/services/authService';
import { referralService } from '@/services/referralService';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { getGuestId } from '@/lib/guestId';
import { mergeGuestDataIntoAccount } from '@/services/mock/mockUserData';

interface AuthContextValue {
  user: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Effective identity used to namespace cart/wishlist — the real user id when signed in, else a stable guest id. */
  identityId: string;
  signUp: (input: SignUpInput) => Promise<Profile>;
  signIn: (email: string, password: string) => Promise<Profile>;
  signInWithGoogle: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const profile = await authService.getSession();
      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();

    if (!env.useMockData) {
      const { data: subscription } = supabase.auth.onAuthStateChange(() => {
        loadSession();
      });
      return () => subscription.subscription.unsubscribe();
    }
  }, [loadSession]);

  const signUp = useCallback(async (input: SignUpInput) => {
    const guestId = getGuestId();
    const profile = await authService.signUp(input);
    if (env.useMockData) mergeGuestDataIntoAccount(guestId, profile.id);
    await referralService.applyReferralCode(profile);
    setUser(profile);
    toast.success(`Welcome to DressMart, ${profile.full_name.split(' ')[0]}!`);
    return profile;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const guestId = getGuestId();
    const profile = await authService.signIn(email, password);
    if (env.useMockData) mergeGuestDataIntoAccount(guestId, profile.id);
    setUser(profile);
    toast.success(`Welcome back, ${profile.full_name.split(' ')[0]}!`);
    return profile;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle();
    await loadSession();
    return authService.getSession();
  }, [loadSession]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
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
      refreshProfile: loadSession,
    }),
    [user, isLoading, signUp, signIn, signInWithGoogle, signOut, loadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { queryKeys } from '@/lib/queryClient';
import type { Profile } from '@/types';

type ProfileUpdate = Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>;

/**
 * The single reusable hook every page should use to read or update the current user's profile —
 * do not call authService/AuthContext directly from a page component. `AuthContext.user` stays the
 * ultimate source of truth (every other hook/component already reads it via useAuth()), but this
 * mirrors it into the React Query cache so profile edits get real optimistic updates: the UI
 * reflects a name/avatar change instantly, rolls back on failure, and reconciles with the real
 * session afterward via refreshProfile().
 */
export function useProfile() {
  const { user, isLoading: isAuthLoading, refreshProfile, identityId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.profile.detail(identityId);

  const profileQuery = useQuery({
    queryKey,
    queryFn: async () => user,
    initialData: user,
    enabled: Boolean(user),
  });

  const updateProfile = useMutation({
    mutationFn: (updates: ProfileUpdate) => {
      if (!user) throw new Error('You must be signed in to update your profile.');
      return authService.updateProfile(user.id, updates);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Profile | null>(queryKey);
      queryClient.setQueryData<Profile | null>(queryKey, (old) => (old ? { ...old, ...updates } : old));
      return { previous };
    },
    onError: (error: Error, _updates, context) => {
      if (context) queryClient.setQueryData(queryKey, context.previous);
      toast.error(error.message);
    },
    onSuccess: async (updatedProfile) => {
      // Seed the cache from the mutation's own authoritative return value — NOT invalidateQueries(),
      // which would force a refetch of every mounted useProfile() instance's queryFn (`() => user`).
      // That closure can still be capturing the PRE-update `user` at the moment the refetch fires
      // (React hasn't necessarily re-rendered that instance with AuthContext's new value yet), which
      // would silently overwrite this exact optimistic update with stale data a moment later.
      queryClient.setQueryData(queryKey, updatedProfile);
      // Reconciles AuthContext.user — the value Header/MobileMenu/ProfileHeroCard/etc. all read via
      // useAuth() directly — so the whole app, not just this hook's own cache entry, stays in sync.
      await refreshProfile();
    },
  });

  return {
    profile: profileQuery.data ?? null,
    isLoading: isAuthLoading || profileQuery.isLoading,
    updateProfile: updateProfile.mutateAsync,
    isUpdating: updateProfile.isPending,
  };
}

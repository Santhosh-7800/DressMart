import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import type { Profile } from '@/types';

type ProfileUpdate = Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>;

/**
 * The single reusable hook every page should use to read or update the current user's profile —
 * do not call authService/AuthContext directly from a page component. `AuthContext.user` is a
 * realtime Firestore subscription (see AuthContext's onSnapshot), so it already updates itself the
 * moment `authService.updateProfile` writes — no separate cache mirror or manual refresh call is
 * needed here, unlike a one-shot-fetch backend would require.
 */
export function useProfile() {
  const { user, isLoading } = useAuth();

  const updateProfile = useMutation({
    mutationFn: (updates: ProfileUpdate) => {
      if (!user) throw new Error('You must be signed in to update your profile.');
      return authService.updateProfile(user.id, updates);
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });

  return {
    profile: user,
    isLoading,
    updateProfile: updateProfile.mutateAsync,
    isUpdating: updateProfile.isPending,
  };
}

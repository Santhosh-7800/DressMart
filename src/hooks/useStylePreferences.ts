import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stylePreferencesService, type StylePreferencesInput } from '@/services/stylePreferencesService';
import { useAuth } from '@/contexts/AuthContext';

export function useStylePreferences() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['style-preferences', identityId];

  const query = useQuery({
    queryKey,
    queryFn: () => stylePreferencesService.get(identityId),
  });

  const save = useMutation({
    mutationFn: (input: StylePreferencesInput) => stylePreferencesService.save(identityId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    isSaving: save.isPending,
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rewardsService } from '@/services/rewardsService';
import { useAuth } from '@/contexts/AuthContext';

export function useRewardsWallet() {
  const { identityId } = useAuth();
  return useQuery({
    queryKey: ['rewards-wallet', identityId],
    queryFn: () => rewardsService.getWallet(identityId),
  });
}

export function useRewardsHistory() {
  const { identityId } = useAuth();
  return useQuery({
    queryKey: ['rewards-history', identityId],
    queryFn: () => rewardsService.getHistory(identityId),
  });
}

export function useRedeemPoints() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ points, orderId }: { points: number; orderId: string | null }) => rewardsService.redeemPoints(identityId, points, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards-wallet', identityId] });
      queryClient.invalidateQueries({ queryKey: ['rewards-history', identityId] });
    },
  });
}

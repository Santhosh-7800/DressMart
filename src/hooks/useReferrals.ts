import { useQuery } from '@tanstack/react-query';
import { referralService } from '@/services/referralService';
import { useAuth } from '@/contexts/AuthContext';

export function useReferralHistory() {
  const { identityId } = useAuth();
  return useQuery({
    queryKey: ['referral-history', identityId],
    queryFn: () => referralService.getHistory(identityId),
  });
}

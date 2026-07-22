import { useQuery } from '@tanstack/react-query';
import { couponService } from '@/services/couponService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

export function useCoupons() {
  const { identityId } = useAuth();
  return useQuery({ queryKey: [...queryKeys.coupons.all, identityId], queryFn: () => couponService.list(identityId) });
}

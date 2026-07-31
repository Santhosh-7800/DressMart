import { useQuery } from '@tanstack/react-query';
import { listActiveCoupons } from '@/services/couponService';
import { queryKeys } from '@/lib/queryClient';

/** Public, currently-usable coupons — same list for every visitor, signed in or not. */
export function useCoupons() {
  return useQuery({ queryKey: queryKeys.coupons.all, queryFn: () => listActiveCoupons() });
}

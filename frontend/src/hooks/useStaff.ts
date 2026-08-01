import { useQuery } from '@tanstack/react-query';
import { staffService } from '@/services/staffService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { isStaffRole } from '@/lib/roles';

/**
 * The signed-in staff member's own permission grants — drives both firestore.rules-backed writes
 * and, here, hiding actions in the UI the account can't perform anyway. Returns `undefined` for
 * any non-staff role (seller/head_seller/buyer), which every call site treats as "no permission
 * gate applies" — see e.g. SellerProductsPage's canEdit/canDelete.
 */
export function useStaffPermissions() {
  const { user } = useAuth();
  const isStaff = isStaffRole(user?.role);
  return useQuery({
    queryKey: queryKeys.staff.permissions(user?.id ?? ''),
    queryFn: () => staffService.getOwnPermissions(user!.id),
    enabled: isStaff && Boolean(user?.id),
  });
}

export function useOwnStaffActivity() {
  const { user } = useAuth();
  const isStaff = isStaffRole(user?.role);
  return useQuery({
    queryKey: queryKeys.staff.ownActivity(user?.id ?? ''),
    queryFn: () => staffService.listOwnActivity(user!.id),
    enabled: isStaff && Boolean(user?.id),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { staffProductService, type StaffContext } from '@/services/staffProductService';
import { queryKeys } from '@/lib/queryClient';
import type { StaffProductInput } from '@/types';

const STAFF_PRODUCTS_KEY = ['staff', 'products'] as const;

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: STAFF_PRODUCTS_KEY });
  queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
}

export function useStaffProducts(staffId: string | undefined) {
  return useQuery({
    queryKey: [...STAFF_PRODUCTS_KEY, 'list', staffId ?? ''],
    queryFn: () => staffProductService.list(staffId as string),
    enabled: Boolean(staffId),
  });
}

export function useStaffProduct(productId: string | undefined, staffId: string | undefined) {
  return useQuery({
    queryKey: [...STAFF_PRODUCTS_KEY, 'detail', productId ?? '', staffId ?? ''],
    queryFn: () => staffProductService.getOwnById(productId as string, staffId as string),
    enabled: Boolean(productId) && Boolean(staffId),
  });
}

export function useCreateStaffProduct(staff: StaffContext | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, status }: { input: StaffProductInput; status: 'draft' | 'pending' }) => staffProductService.create(input, staff as StaffContext, status),
    onSuccess: (_product, { status }) => {
      invalidate(queryClient);
      toast.success(status === 'draft' ? 'Saved as draft' : 'Product submitted for approval');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateStaffProduct(staff: StaffContext | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, status }: { input: StaffProductInput; status: 'draft' | 'pending' }) => staffProductService.update(input, staff as StaffContext, status),
    onSuccess: (product) => {
      invalidate(queryClient);
      toast.success(product.approval_status === 'draft' ? 'Draft saved' : 'Product updated — resubmitted for approval');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

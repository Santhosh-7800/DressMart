import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminProductService } from '@/services/adminProductService';
import { queryKeys } from '@/lib/queryClient';
import type { AdminProductInput, BulkProductAction, Product } from '@/types';

const ADMIN_PRODUCTS_KEY = ['admin', 'products'] as const;

function invalidateProductQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_KEY });
  // Every customer-facing product list/detail query keys off queryKeys.products.* — invalidating
  // that root is what makes an admin save/delete "immediately appear" in the customer app.
  queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
}

export function useAdminProducts(search: string, page: number, pageSize = 20) {
  return useQuery({
    queryKey: [...ADMIN_PRODUCTS_KEY, 'list', search, page, pageSize],
    queryFn: () => adminProductService.list(search, page, pageSize),
  });
}

export function useAdminProduct(productId: string | undefined) {
  return useQuery({
    queryKey: [...ADMIN_PRODUCTS_KEY, 'detail', productId ?? ''],
    queryFn: () => adminProductService.getById(productId as string),
    enabled: Boolean(productId),
  });
}

export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminProductInput) => adminProductService.save(input),
    onSuccess: (_product, input) => {
      invalidateProductQueries(queryClient);
      toast.success(input.id ? 'Product updated' : 'Product created');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDuplicateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Product) => adminProductService.duplicate(product),
    onSuccess: () => {
      invalidateProductQueries(queryClient);
      toast.success('Product duplicated as a draft');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetProductActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isActive }: { productId: string; isActive: boolean }) => adminProductService.setActive(productId, isActive),
    onSuccess: (_r, { isActive }) => {
      invalidateProductQueries(queryClient);
      toast.success(isActive ? 'Product published' : 'Product hidden');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => adminProductService.remove(productId),
    onSuccess: () => {
      invalidateProductQueries(queryClient);
      toast.success('Product deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useBulkProductAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productIds, action }: { productIds: string[]; action: BulkProductAction }) => adminProductService.bulkAction(productIds, action),
    onSuccess: (_r, { productIds, action }) => {
      invalidateProductQueries(queryClient);
      const verb = action === 'delete' ? 'deleted' : action === 'publish' ? 'published' : 'hidden';
      toast.success(`${productIds.length} product(s) ${verb}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useStaffSubmissions() {
  return useQuery({
    queryKey: [...ADMIN_PRODUCTS_KEY, 'staff-submissions'],
    queryFn: () => adminProductService.listStaffSubmissions(),
  });
}

export function useApproveStaffProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => adminProductService.approveStaffProduct(productId),
    onSuccess: () => {
      invalidateProductQueries(queryClient);
      toast.success('Product approved — now live in the store');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRejectStaffProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => adminProductService.rejectStaffProduct(productId),
    onSuccess: () => {
      invalidateProductQueries(queryClient);
      toast.success('Product rejected');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useBulkImportProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: AdminProductInput[]) => adminProductService.bulkImport(rows),
    onSuccess: (created) => {
      invalidateProductQueries(queryClient);
      toast.success(`Imported ${created.length} product(s)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

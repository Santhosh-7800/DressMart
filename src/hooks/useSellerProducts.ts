import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productService } from '@/services/productService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { SellerProductInput } from '@/types';

/** The signed-in seller's own products (any status) — powers SellerProductsPage / SellerInventoryPage. */
export function useSellerProducts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.products.bySeller(user?.id ?? ''),
    queryFn: () => productService.getBySeller(user!.id),
    enabled: Boolean(user?.id),
  });
}

/** A single own product for the edit form — reuses the public getById (no seller-only fields to gate). */
export function useSellerProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ['products', 'seller-detail', productId ?? ''],
    queryFn: () => productService.getById(productId as string),
    enabled: Boolean(productId),
  });
}

export function useCreateProduct() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SellerProductInput) => productService.create(user!.id, user!.store_name ?? user!.full_name, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      toast.success('Product created');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateProduct() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: SellerProductInput }) =>
      productService.update(productId, user!.id, user!.store_name ?? user!.full_name, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success('Product updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetProductActive() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isActive }: { productId: string; isActive: boolean }) => productService.setActive(productId, isActive),
    onSuccess: (_data, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      toast.success(isActive ? 'Product published' : 'Product hidden');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteProduct() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => productService.remove(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      toast.success('Product deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

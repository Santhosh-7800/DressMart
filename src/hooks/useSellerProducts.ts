import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productService } from '@/services/productService';
import { queryKeys } from '@/lib/queryClient';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductStatus, SellerProductInput } from '@/types';

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

/**
 * Creates a product for the given seller. `sellerId`/`sellerName` are passed in explicitly by the
 * caller (defaulting to the signed-in user for a normal "create my own product" flow) rather than
 * always assumed from useAuth() here — see useUpdateProduct's ownership note below.
 */
export function useCreateProduct() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sellerId, sellerName, input }: { sellerId: string; sellerName: string; input: SellerProductInput }) =>
      productService.create(sellerId, sellerName, input),
    onSuccess: (_data, { sellerId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(sellerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: ['products', 'all-sellers'] });
      toast.success('Product created');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

/**
 * Updates an existing product. `sellerId`/`sellerName` MUST be the product's existing owner, not
 * necessarily the signed-in user — a Head Seller editing another seller's product must never
 * accidentally transfer ownership to themselves by having this default to their own id/name.
 */
export function useUpdateProduct() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, sellerId, sellerName, input }: { productId: string; sellerId: string; sellerName: string; input: SellerProductInput }) =>
      productService.update(productId, sellerId, sellerName, input),
    onSuccess: (_data, { sellerId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(sellerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: ['products', 'all-sellers'] });
      toast.success('Product updated');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'moved to draft',
  active: 'published',
  out_of_stock: 'marked out of stock',
  hidden: 'hidden',
};

/** Sets a product's merchandising status (draft/active/out_of_stock/hidden) — replaces the old
 *  boolean is_active toggle. Used by the Seller Products list's quick publish/hide actions and by
 *  the Head Seller's All Products page. */
export function useSetProductStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, status }: { productId: string; status: ProductStatus }) => productService.setStatus(productId, status),
    onSuccess: (_data, { status }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: ['products', 'all-sellers'] });
      toast.success(`Product ${STATUS_LABELS[status]}`);
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

/** Head-Seller-only "Feature this product" toggle. */
export function useSetProductFeatured() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, featured }: { productId: string; featured: boolean }) => productService.setFeatured(productId, featured),
    onSuccess: (_data, { featured }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: ['products', 'all-sellers'] });
      toast.success(featured ? 'Product featured' : 'Product unfeatured');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

/** Every product across every seller/status — powers the Head Seller's All Products page. */
export function useAllSellerProducts() {
  return useQuery({
    queryKey: ['products', 'all-sellers'],
    queryFn: () => productService.listAll(),
  });
}

export function useDeleteProduct() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => productService.remove(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: ['products', 'all-sellers'] });
      toast.success('Product deleted');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

/** Duplicates one of the signed-in seller's own products into a new draft. */
export function useDuplicateProduct() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, sellerId, sellerName }: { productId: string; sellerId: string; sellerName: string }) =>
      productService.duplicate(productId, sellerId, sellerName),
    onSuccess: (_data, { sellerId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(sellerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: ['products', 'all-sellers'] });
      toast.success('Product duplicated as a draft');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

/** Head-Seller-only "Deal of the Day" toggle — mirrors useSetProductFeatured. */
export function useSetProductDealOfDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isDeal, dealEndsAt }: { productId: string; isDeal: boolean; dealEndsAt: string | null }) =>
      productService.setDealOfDay(productId, isDeal, dealEndsAt),
    onSuccess: (_data, { isDeal }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: ['products', 'all-sellers'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'deals'] });
      toast.success(isDeal ? 'Product added to Deal of the Day' : 'Product removed from Deal of the Day');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandService, categoryService, productService } from '@/services/productService';
import { reviewService } from '@/services/reviewService';
import { bannerService } from '@/services/bannerService';
import { queryKeys } from '@/lib/queryClient';
import { buildCompleteTheLook } from '@/lib/completeTheLookRecommender';
import type { Product, ProductFilters, SubmitReviewInput } from '@/types';

export function useProductList(filters: ProductFilters) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => productService.list(filters),
  });
}

/**
 * Same data as useProductList, but accumulated page-by-page for infinite scroll instead of a single
 * page — the query key deliberately excludes `page` (see queryKeys.products.listInfinite) since an
 * infinite query has ONE cache entry per filter-set that TanStack Query grows itself; passing `page`
 * through the key would fork a separate cache entry per page instead of accumulating one list.
 */
export function useInfiniteProductList(filters: ProductFilters) {
  const { page: _page, ...keyFilters } = filters;
  return useInfiniteQuery({
    queryKey: queryKeys.products.listInfinite(keyFilters),
    queryFn: ({ pageParam }) => productService.list({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(slug ?? ''),
    queryFn: () => productService.getBySlug(slug as string),
    enabled: Boolean(slug),
  });
}

/**
 * Realtime subscription on the product doc itself — layered on top of the cache-backed
 * `useProduct(slug)` first paint so a seller's price/status/image/color/stock-threshold edit shows
 * up on the PDP immediately, without a refetch or page refresh. Returns `undefined` until the
 * first snapshot arrives (or immediately if no id is given yet); the caller should merge this with
 * the initial query result, e.g. `liveProduct ?? initialProduct`.
 */
export function useProductRealtime(productId: string | null | undefined) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);

  useEffect(() => {
    if (!productId) {
      setProduct(undefined);
      return;
    }
    setProduct(undefined);
    const unsubscribe = productService.subscribeToProduct(productId, setProduct);
    return unsubscribe;
  }, [productId]);

  return { data: product, isLoading: product === undefined };
}

export function useRelatedProducts(product: Product | null | undefined) {
  return useQuery({
    queryKey: queryKeys.products.related(product?.id ?? ''),
    queryFn: () => productService.getRelated(product as Product),
    enabled: Boolean(product),
  });
}

export function useFrequentlyBoughtTogether(product: Product | null | undefined) {
  return useQuery({
    queryKey: ['products', 'fbt', product?.id],
    queryFn: () => productService.getFrequentlyBoughtTogether(product as Product),
    enabled: Boolean(product),
  });
}

export function useCompleteTheLook(product: Product | null | undefined) {
  return useQuery({
    queryKey: ['products', 'complete-the-look', product?.id],
    queryFn: () => buildCompleteTheLook(product as Product),
    enabled: Boolean(product),
  });
}

export function useProductFacets(gender?: string, categorySlug?: string) {
  return useQuery({
    queryKey: queryKeys.products.facets(gender, categorySlug),
    queryFn: () => productService.getFacets(gender, categorySlug),
  });
}

export function useReviews(productId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews.byProduct(productId ?? ''),
    queryFn: () => reviewService.listForProduct(productId as string),
    enabled: Boolean(productId),
  });
}

/** Average rating / review count / star distribution — always computed live, never a stored field. */
export function useRatingSummary(productId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews.summary(productId ?? ''),
    queryFn: () => reviewService.getRatingSummary(productId as string),
    enabled: Boolean(productId),
  });
}

export function useReviewableOrderItems(userId: string | null | undefined, productId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews.reviewable(userId ?? '', productId ?? ''),
    queryFn: () => reviewService.getReviewableOrderItems(userId as string, productId as string),
    enabled: Boolean(userId) && Boolean(productId),
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, userName, userAvatar }: { input: SubmitReviewInput; userName: string; userAvatar?: string | null }) =>
      reviewService.submit(input, userName, userAvatar ?? null),
    onSuccess: (_review, { input }) => {
      // Invalidate everywhere a rating/review can be displayed — card, PDP, search, category —
      // so the new review's effect on the average/count/distribution shows up immediately.
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byProduct(input.product_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.summary(input.product_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.reviewable(input.user_id, input.product_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}

export function useCategories(gender?: string) {
  return useQuery({
    queryKey: gender ? queryKeys.categories.byGender(gender) : queryKeys.categories.all,
    queryFn: () => categoryService.list(gender),
  });
}

export function useFeaturedBrands() {
  return useQuery({ queryKey: queryKeys.brands.featured, queryFn: () => brandService.featured() });
}

export function useBanners() {
  return useQuery({ queryKey: queryKeys.banners.all, queryFn: () => bannerService.list() });
}

export function useDealsOfTheDay() {
  return useQuery({ queryKey: ['products', 'deals'], queryFn: () => productService.getDealsOfTheDay() });
}

export function useFlashSales() {
  // Polls so expired items actually drop out of the list without a page reload —
  // per-card countdowns handle the immediate visual expiry between polls.
  return useQuery({ queryKey: ['products', 'flash-sales'], queryFn: () => productService.getFlashSales(), refetchInterval: 30_000 });
}

export function useTrendingProducts() {
  return useQuery({ queryKey: ['products', 'trending'], queryFn: () => productService.getTrending() });
}

export function useNewArrivals() {
  return useQuery({ queryKey: ['products', 'new-arrivals'], queryFn: () => productService.getNewArrivals() });
}

export function useTopRated() {
  return useQuery({ queryKey: ['products', 'top-rated'], queryFn: () => productService.getTopRated() });
}

export function useBestSellers() {
  return useQuery({ queryKey: ['products', 'best-sellers'], queryFn: () => productService.getBestSellers() });
}

export function useFeaturedCollections() {
  return useQuery({ queryKey: ['products', 'featured-collections'], queryFn: () => productService.getFeaturedCollections() });
}

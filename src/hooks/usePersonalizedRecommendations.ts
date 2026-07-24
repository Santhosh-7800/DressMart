import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRecentlyViewed } from './useRecentlyViewed';
import { useWishlist } from './useWishlist';
import { useOrders } from './useOrders';
import { useCategoryHistory } from './useCategoryHistory';
import { productService } from '@/services/productService';
import { buildPersonalizedRecommendations } from '@/lib/personalizedRecommender';
import type { Product } from '@/types';

export function usePersonalizedRecommendations() {
  const { identityId } = useAuth();
  const { recentlyViewed, isLoading: isLoadingRecent } = useRecentlyViewed();
  const { items: wishlistItems, isLoading: isLoadingWishlist } = useWishlist();
  const { data: orders, isLoading: isLoadingOrders } = useOrders();
  const { categorySlugs: categoryHistorySlugs } = useCategoryHistory();

  const wishlistProducts = wishlistItems.map((i) => i.product).filter((p): p is Product => Boolean(p));
  const orderProductIds = Array.from(new Set((orders ?? []).flatMap((o) => o.items.map((i) => i.product_id))));

  const orderedProductsQuery = useQuery({
    queryKey: ['products', 'ordered-history', identityId, orderProductIds],
    queryFn: () => productService.getByIds(orderProductIds),
    enabled: orderProductIds.length > 0,
  });

  const signalsReady = !isLoadingRecent && !isLoadingWishlist && !isLoadingOrders && (orderProductIds.length === 0 || orderedProductsQuery.isSuccess);
  const orderedProducts = orderedProductsQuery.data ?? [];

  const recommendationsQuery = useQuery({
    queryKey: [
      'products',
      'personalized',
      identityId,
      recentlyViewed.map((p) => p.id),
      wishlistProducts.map((p) => p.id),
      orderedProducts.map((p) => p.id),
      categoryHistorySlugs,
    ],
    queryFn: () => buildPersonalizedRecommendations({ recentlyViewed, wishlistProducts, orderedProducts, categoryHistorySlugs }),
    enabled: signalsReady,
  });

  return {
    recommendations: recommendationsQuery.data?.products ?? [],
    topCategoryLabel: recommendationsQuery.data?.topCategoryLabel ?? null,
    isLoading: !signalsReady || recommendationsQuery.isLoading,
    isError: orderedProductsQuery.isError || recommendationsQuery.isError,
    retry: () => {
      orderedProductsQuery.refetch();
      recommendationsQuery.refetch();
    },
  };
}

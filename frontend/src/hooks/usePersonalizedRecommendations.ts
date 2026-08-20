import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRecentlyViewed } from './useRecentlyViewed';
import { useWishlist } from './useWishlist';
import { useOrders } from './useOrders';
import { useCart } from './useCart';
import { useCategoryHistory } from './useCategoryHistory';
import { productService, categoryService, brandService } from '@/services/productService';
import { userActivityService } from '@/services/userActivityService';
import { buildPersonalizedRecommendations } from '@/lib/personalizedRecommender';
import { queryKeys } from '@/lib/queryClient';
import type { Product } from '@/types';

export function usePersonalizedRecommendations() {
  const { identityId, isAuthenticated } = useAuth();
  const { recentlyViewed, isLoading: isLoadingRecent } = useRecentlyViewed();
  const { items: wishlistItems, isLoading: isLoadingWishlist } = useWishlist();
  const { data: orders, isLoading: isLoadingOrders } = useOrders();
  const { items: cartItems, isLoading: isLoadingCart } = useCart();
  const { categorySlugs: categoryHistorySlugs } = useCategoryHistory();

  const wishlistProducts = wishlistItems.map((i) => i.product).filter((p): p is Product => Boolean(p));
  const cartProducts = cartItems.map((i) => i.product).filter((p): p is Product => Boolean(p));
  const orderProductIds = Array.from(new Set((orders ?? []).flatMap((o) => o.items.map((i) => i.product_id))));

  const orderedProductsQuery = useQuery({
    queryKey: ['products', 'ordered-history', identityId, orderProductIds],
    queryFn: () => productService.getByIds(orderProductIds),
    enabled: orderProductIds.length > 0,
  });

  // Search history is a signed-in-only, permanent Firestore signal (see useSearch.ts/
  // userActivityService.ts) — guests never get one, so they just fall back to the other three
  // signals above, same as before this was added. Categories/brands reuse the exact same query
  // keys useSearch.ts's suggestion dropdown already warms, so this is very often a cache hit and
  // not an extra Firestore read at all.
  const searchHistoryQuery = useQuery({
    queryKey: ['user-activity', identityId, 'search-history'],
    queryFn: () => userActivityService.get(identityId).then((activity) => activity.recent_searches),
    enabled: isAuthenticated,
  });
  const categoriesQuery = useQuery({ queryKey: queryKeys.categories.all, queryFn: () => categoryService.list(), enabled: isAuthenticated });
  const brandsQuery = useQuery({ queryKey: queryKeys.brands.all, queryFn: () => brandService.list(), enabled: isAuthenticated });

  const signalsReady =
    !isLoadingRecent &&
    !isLoadingWishlist &&
    !isLoadingOrders &&
    !isLoadingCart &&
    (orderProductIds.length === 0 || orderedProductsQuery.isSuccess) &&
    (!isAuthenticated || (searchHistoryQuery.isSuccess && categoriesQuery.isSuccess && brandsQuery.isSuccess));
  const orderedProducts = orderedProductsQuery.data ?? [];
  const searchHistory = searchHistoryQuery.data ?? [];

  const recommendationsQuery = useQuery({
    queryKey: [
      'products',
      'personalized',
      identityId,
      recentlyViewed.map((p) => p.id),
      wishlistProducts.map((p) => p.id),
      cartProducts.map((p) => p.id),
      orderedProducts.map((p) => p.id),
      categoryHistorySlugs,
      searchHistory.map((s) => s.normalized_query),
    ],
    queryFn: () =>
      buildPersonalizedRecommendations({
        recentlyViewed,
        wishlistProducts,
        cartProducts,
        orderedProducts,
        categoryHistorySlugs,
        searchHistory,
        categories: categoriesQuery.data,
        brands: brandsQuery.data,
      }),
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

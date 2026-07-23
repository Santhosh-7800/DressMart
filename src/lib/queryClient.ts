import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (filters: unknown) => ['products', 'list', filters] as const,
    detail: (slug: string) => ['products', 'detail', slug] as const,
    related: (productId: string) => ['products', 'related', productId] as const,
    facets: (gender?: string, categorySlug?: string) => ['products', 'facets', gender, categorySlug] as const,
    bySeller: (sellerId: string) => ['products', 'seller', sellerId] as const,
  },
  inventory: {
    detail: (productId: string) => ['inventory', 'detail', productId] as const,
  },
  categories: {
    all: ['categories'] as const,
    byGender: (gender: string) => ['categories', gender] as const,
  },
  brands: {
    all: ['brands'] as const,
    featured: ['brands', 'featured'] as const,
  },
  cart: {
    all: ['cart'] as const,
  },
  wishlist: {
    all: ['wishlist'] as const,
  },
  orders: {
    all: ['orders'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    bySeller: (sellerId: string) => ['orders', 'seller', sellerId] as const,
  },
  exchanges: {
    all: ['exchanges'] as const,
    bySeller: (sellerId: string) => ['exchanges', 'seller', sellerId] as const,
  },
  sellerRequests: {
    all: ['seller-requests'] as const,
  },
  addresses: {
    all: ['addresses'] as const,
  },
  profile: {
    detail: (userId: string) => ['profile', 'detail', userId] as const,
  },
  reviews: {
    byProduct: (productId: string) => ['reviews', productId] as const,
    summary: (productId: string) => ['reviews', 'summary', productId] as const,
    reviewable: (userId: string, productId: string) => ['reviews', 'reviewable', userId, productId] as const,
  },
  coupons: {
    all: ['coupons'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
  },
  returns: {
    all: ['returns'] as const,
    bySeller: (sellerId: string) => ['returns', 'seller', sellerId] as const,
  },
  seller: {
    overview: (sellerId: string) => ['seller', 'overview', sellerId] as const,
    platformOverview: ['seller', 'platform-overview'] as const,
    sellers: ['seller', 'roster'] as const,
    recentOrders: (maxDocs: number) => ['seller', 'recent-orders', maxDocs] as const,
    platformSettings: ['seller', 'platform-settings'] as const,
  },
} as const;

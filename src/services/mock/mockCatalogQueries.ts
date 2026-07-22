import type { PaginatedResult, Product, ProductFacets, ProductFilters } from '@/types';
import { getActiveCatalog as buildCatalog } from './mockCatalogWithOverrides';

function matchesFilters(product: Product, filters: ProductFilters): boolean {
  if (filters.gender && product.gender !== filters.gender) return false;
  if (filters.categorySlugs?.length && !filters.categorySlugs.includes(product.category?.slug ?? '')) return false;
  if (filters.brandIds?.length && !filters.brandIds.includes(product.brand_id)) return false;
  if (filters.colors?.length) {
    const productColors = product.variants.map((v) => v.color);
    if (!filters.colors.some((c) => productColors.includes(c))) return false;
  }
  if (filters.sizes?.length) {
    const productSizes = product.variants.map((v) => v.size);
    if (!filters.sizes.some((s) => productSizes.includes(s))) return false;
  }
  if (filters.minPrice !== undefined && product.price < filters.minPrice) return false;
  if (filters.maxPrice !== undefined && product.price > filters.maxPrice) return false;
  if (filters.minRating !== undefined && product.rating < filters.minRating) return false;
  if (filters.minDiscount !== undefined && product.discount_percent < filters.minDiscount) return false;
  if (filters.inStockOnly && product.total_stock <= 0) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const haystack = `${product.name} ${product.brand?.name ?? ''} ${product.category?.name ?? ''} ${product.tags.join(' ')}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function sortProducts(products: Product[], sort: ProductFilters['sort']): Product[] {
  const sorted = [...products];
  switch (sort) {
    case 'price_low_high':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price_high_low':
      return sorted.sort((a, b) => b.price - a.price);
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'discount':
      return sorted.sort((a, b) => b.discount_percent - a.discount_percent);
    case 'popularity':
    default:
      return sorted.sort((a, b) => b.rating_count - a.rating_count);
  }
}

export function queryProducts(filters: ProductFilters): PaginatedResult<Product> {
  const { products } = buildCatalog();
  const filtered = sortProducts(products.filter((p) => matchesFilters(p, filters)), filters.sort);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    total: filtered.length,
    page,
    pageSize,
    hasMore: start + pageSize < filtered.length,
  };
}

export function getProductBySlug(slug: string): Product | null {
  const { products } = buildCatalog();
  return products.find((p) => p.slug === slug) ?? null;
}

export function getProductById(id: string): Product | null {
  const { products } = buildCatalog();
  return products.find((p) => p.id === id) ?? null;
}

export function getRelatedProducts(product: Product, limit = 8): Product[] {
  const { products } = buildCatalog();
  return products
    .filter((p) => p.id !== product.id && p.category_id === product.category_id)
    .sort((a, b) => b.rating_count - a.rating_count)
    .slice(0, limit);
}

export function getFrequentlyBoughtTogether(product: Product, limit = 3): Product[] {
  const { products } = buildCatalog();
  return products
    .filter((p) => p.id !== product.id && p.gender === product.gender && p.category_id !== product.category_id)
    .slice(0, limit);
}

export function getFacets(gender?: string, categorySlug?: string): ProductFacets {
  const { products } = buildCatalog();
  const scoped = products.filter((p) => (!gender || p.gender === gender) && (!categorySlug || p.category?.slug === categorySlug));

  // Keyed by brand_id — the actual field every filter path matches against — with the display
  // name carried alongside as `label`. Counting by name here (instead) previously meant the
  // facet's `value` never matched `product.brand_id`, so selecting any brand always returned zero
  // products.
  const brandCounts = new Map<string, { label: string; count: number }>();
  const colorCounts = new Map<string, number>();
  const sizeCounts = new Map<string, number>();
  let min = Infinity;
  let max = 0;

  scoped.forEach((p) => {
    const existing = brandCounts.get(p.brand_id);
    brandCounts.set(p.brand_id, { label: p.brand?.name ?? '', count: (existing?.count ?? 0) + 1 });
    p.variants.forEach((v) => {
      colorCounts.set(v.color, (colorCounts.get(v.color) ?? 0) + 1);
      sizeCounts.set(v.size, (sizeCounts.get(v.size) ?? 0) + 1);
    });
    min = Math.min(min, p.price);
    max = Math.max(max, p.price);
  });

  const toFacetList = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  const brandFacetList = Array.from(brandCounts.entries())
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    brands: brandFacetList,
    colors: toFacetList(colorCounts),
    sizes: toFacetList(sizeCounts),
    priceRange: { min: min === Infinity ? 0 : min, max },
  };
}

export function getDealsOfTheDay(limit = 12): Product[] {
  const { products } = buildCatalog();
  return products.filter((p) => p.is_deal_of_day).slice(0, limit);
}

export function getFlashSales(limit = 12): Product[] {
  const { products } = buildCatalog();
  const now = Date.now();
  return products
    .filter((p) => p.is_flash_sale && p.flash_sale_ends_at && new Date(p.flash_sale_ends_at).getTime() > now)
    .sort((a, b) => new Date(a.flash_sale_ends_at as string).getTime() - new Date(b.flash_sale_ends_at as string).getTime())
    .slice(0, limit);
}

export function getTrending(limit = 12): Product[] {
  const { products } = buildCatalog();
  return products.filter((p) => p.is_trending).slice(0, limit);
}

export function getNewArrivals(limit = 12): Product[] {
  const { products } = buildCatalog();
  return [...products.filter((p) => p.is_new_arrival)].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
}

export function getTopRated(limit = 12): Product[] {
  const { products } = buildCatalog();
  return [...products].sort((a, b) => b.rating - a.rating || b.rating_count - a.rating_count).slice(0, limit);
}

export function getBestSellers(limit = 12): Product[] {
  const { products } = buildCatalog();
  return products.filter((p) => p.is_bestseller).slice(0, limit);
}

export function getFeaturedCollections(): { title: string; slug: string; products: Product[] }[] {
  const { products } = buildCatalog();
  return [
    { title: 'Office Ready', slug: 'office-ready', products: products.filter((p) => p.category?.slug === 'formal-shirts').slice(0, 8) },
    { title: 'Weekend Casuals', slug: 'weekend-casuals', products: products.filter((p) => p.category?.slug === 'casual-shirts' || p.category?.slug === 'joggers').slice(0, 8) },
    { title: 'Denim Edit', slug: 'denim-edit', products: products.filter((p) => p.category?.slug.includes('jeans')).slice(0, 8) },
    { title: 'Little Explorers', slug: 'little-explorers', products: products.filter((p) => p.gender === 'kids').slice(0, 8) },
  ];
}

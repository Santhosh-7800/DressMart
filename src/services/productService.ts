import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type {
  Brand,
  Category,
  PaginatedResult,
  Product,
  ProductFacets,
  ProductFilters,
  RatingSummary,
  Review,
  ReviewableOrderItem,
  SubmitReviewInput,
} from '@/types';
import * as mockCatalog from './mock/mockCatalogQueries';
import * as mockReviews from './mock/mockReviews';
import { getCatalog as buildCatalog } from './mock/mockCatalogWithOverrides';

const PRODUCT_SELECT = '*, brand:brands(*), category:categories(*), images:product_images(*), variants:product_variants(*)';

/**
 * Supabase columns are snake_case (image_url/thumbnail_url/gallery_images); the app-layer
 * Product type exposes these as camelCase (imageUrl/thumbnailUrl/galleryImages) — this bridges
 * the two for the new product-photography fields without touching any other field or table.
 */
function hydrateProduct(row: Record<string, unknown>): Product {
  return {
    ...row,
    imageUrl: row.image_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    galleryImages: row.gallery_images ?? undefined,
  } as unknown as Product;
}

function hydrateProducts(rows: Record<string, unknown>[] | null): Product[] {
  return (rows ?? []).map(hydrateProduct);
}

export const productService = {
  async list(filters: ProductFilters): Promise<PaginatedResult<Product>> {
    if (env.useMockData) return mockCatalog.queryProducts(filters);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 24;
    let query = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('is_active', true);

    if (filters.gender) query = query.eq('gender', filters.gender);
    if (filters.brandIds?.length) query = query.in('brand_id', filters.brandIds);
    if (filters.minPrice !== undefined) query = query.gte('price', filters.minPrice);
    if (filters.maxPrice !== undefined) query = query.lte('price', filters.maxPrice);
    if (filters.minRating !== undefined) query = query.gte('rating', filters.minRating);
    if (filters.minDiscount !== undefined) query = query.gte('discount_percent', filters.minDiscount);
    if (filters.search) query = query.ilike('name', `%${filters.search}%`);

    switch (filters.sort) {
      case 'price_low_high':
        query = query.order('price', { ascending: true });
        break;
      case 'price_high_low':
        query = query.order('price', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
      case 'discount':
        query = query.order('discount_percent', { ascending: false });
        break;
      default:
        query = query.order('rating_count', { ascending: false });
    }

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);

    return {
      items: hydrateProducts(data),
      total: count ?? 0,
      page,
      pageSize,
      hasMore: from + pageSize < (count ?? 0),
    };
  },

  async getBySlug(slug: string): Promise<Product | null> {
    if (env.useMockData) return mockCatalog.getProductBySlug(slug);
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('slug', slug).single();
    if (error) return null;
    return hydrateProduct(data);
  },

  async getRelated(product: Product): Promise<Product[]> {
    if (env.useMockData) return mockCatalog.getRelatedProducts(product);
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('category_id', product.category_id)
      .neq('id', product.id)
      .limit(8);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },

  async getFrequentlyBoughtTogether(product: Product): Promise<Product[]> {
    if (env.useMockData) return mockCatalog.getFrequentlyBoughtTogether(product);
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('gender', product.gender)
      .neq('category_id', product.category_id)
      .limit(3);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },

  async getFacets(gender?: string, categorySlug?: string): Promise<ProductFacets> {
    if (env.useMockData) return mockCatalog.getFacets(gender, categorySlug);
    // For a live project, facets are best served by a Postgres function/materialized view.
    // See supabase/migrations/0003_functions.sql -> get_product_facets(gender, category_slug).
    const { data, error } = await supabase.rpc('get_product_facets', { p_gender: gender ?? null, p_category_slug: categorySlug ?? null });
    if (error) throw new Error(error.message);
    return data as ProductFacets;
  },

  async getDealsOfTheDay(): Promise<Product[]> {
    if (env.useMockData) return mockCatalog.getDealsOfTheDay();
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('is_deal_of_day', true).limit(12);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },

  async getFlashSales(): Promise<Product[]> {
    if (env.useMockData) return mockCatalog.getFlashSales();
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('is_flash_sale', true)
      .gt('flash_sale_ends_at', new Date().toISOString())
      .order('flash_sale_ends_at', { ascending: true })
      .limit(12);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },

  async getTrending(): Promise<Product[]> {
    if (env.useMockData) return mockCatalog.getTrending();
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('is_trending', true).limit(12);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },

  async getNewArrivals(): Promise<Product[]> {
    if (env.useMockData) return mockCatalog.getNewArrivals();
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('is_new_arrival', true).order('created_at', { ascending: false }).limit(12);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },

  async getTopRated(): Promise<Product[]> {
    if (env.useMockData) return mockCatalog.getTopRated();
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).order('rating', { ascending: false }).limit(12);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },

  async getBestSellers(): Promise<Product[]> {
    if (env.useMockData) return mockCatalog.getBestSellers();
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('is_bestseller', true).limit(12);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },

  async getFeaturedCollections() {
    if (env.useMockData) return mockCatalog.getFeaturedCollections();
    const { categories } = buildCatalog();
    return categories.slice(0, 4).map((c) => ({ title: c.name, slug: c.slug, products: [] as Product[] }));
  },

  async getByIds(ids: string[]): Promise<Product[]> {
    if (env.useMockData) {
      const { products } = buildCatalog();
      return ids.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
    }
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).in('id', ids);
    if (error) throw new Error(error.message);
    return hydrateProducts(data);
  },
};

export const categoryService = {
  async list(gender?: string): Promise<Category[]> {
    if (env.useMockData) {
      const { categories } = buildCatalog();
      return gender ? categories.filter((c) => c.gender === gender && c.parent_id) : categories;
    }
    let query = supabase.from('categories').select('*').order('sort_order');
    if (gender) query = query.eq('gender', gender);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as Category[];
  },
};

export const brandService = {
  async list(): Promise<Brand[]> {
    if (env.useMockData) return buildCatalog().brands;
    const { data, error } = await supabase.from('brands').select('*').order('name');
    if (error) throw new Error(error.message);
    return data as Brand[];
  },

  async featured(): Promise<Brand[]> {
    if (env.useMockData) return buildCatalog().brands.filter((b) => b.is_featured);
    const { data, error } = await supabase.from('brands').select('*').eq('is_featured', true);
    if (error) throw new Error(error.message);
    return data as Brand[];
  },
};

export const reviewService = {
  async listForProduct(productId: string): Promise<Review[]> {
    if (env.useMockData) return mockReviews.getReviewsForProduct(productId);
    const { data, error } = await supabase.from('reviews').select('*').eq('product_id', productId).order('helpful_count', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Review[];
  },

  /** Always computed live (SQL view / mock equivalent) — never a stored/hardcoded value. */
  async getRatingSummary(productId: string): Promise<RatingSummary> {
    if (env.useMockData) return mockReviews.getRatingSummary(productId);
    const { data, error } = await supabase.rpc('get_rating_summary', { p_product_id: productId });
    if (error) throw new Error(error.message);
    return data as RatingSummary;
  },

  async getRatingSummaries(productIds: string[]): Promise<RatingSummary[]> {
    if (productIds.length === 0) return [];
    if (env.useMockData) return mockReviews.getRatingSummaries(productIds);
    const { data, error } = await supabase.rpc('get_rating_summaries', { p_product_ids: productIds });
    if (error) throw new Error(error.message);
    return data as RatingSummary[];
  },

  /** Delivered, not-yet-reviewed order items for this user+product — gates the "Write a Review" UI. */
  async getReviewableOrderItems(userId: string, productId: string): Promise<ReviewableOrderItem[]> {
    if (env.useMockData) return mockReviews.getReviewableOrderItems(userId, productId);
    const { data, error } = await supabase.rpc('get_reviewable_order_items', { p_user_id: userId, p_product_id: productId });
    if (error) throw new Error(error.message);
    return data as ReviewableOrderItem[];
  },

  async submit(input: SubmitReviewInput, userName: string, userAvatar: string | null): Promise<Review> {
    if (env.useMockData) return mockReviews.submitReview(input, userName, userAvatar);
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        product_id: input.product_id,
        user_id: input.user_id,
        order_id: input.order_id,
        order_item_id: input.order_item_id,
        rating: input.rating,
        review_title: input.review_title ?? null,
        review_text: input.review_text ?? null,
        images: input.images ?? [],
        user_name: userName,
        user_avatar: userAvatar,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Review;
  },
};

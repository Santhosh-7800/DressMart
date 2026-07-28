import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Sparkles, Zap } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { FlashSaleProductCard } from '@/components/product/FlashSaleProductCard';
import { CountdownTimer } from '@/components/product/CountdownTimer';
import { useBanners, useCategories, useDealsOfTheDay, useFeaturedBrands, useFeaturedCollections, useFlashSales, useNewArrivals, useTopRated, useBestSellers, useTrendingProducts } from '@/hooks/useProducts';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { usePersonalizedRecommendations } from '@/hooks/usePersonalizedRecommendations';
import { Skeleton, ProductCardSkeleton } from '@/components/ui/Skeleton';
import { ProductImage } from '@/components/ui/ProductImage';

function BannerSlider() {
  const { data: banners, isLoading, isError } = useBanners();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!banners?.length) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners]);

  if (isLoading) return <Skeleton className="h-48 w-full sm:h-64 lg:h-80" />;
  // A fetch error is distinct from "no banners configured" — silently returning null here would
  // otherwise make the whole homepage banner section vanish on a transient query error.
  if (isError || !banners?.length) return null;

  const banner = banners[index];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-800 to-primary-900 text-white">
      {banner.image_url && (
        <>
          <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-950/80 via-primary-950/40 to-transparent" />
        </>
      )}
      <Link to={banner.link} className="relative flex h-48 flex-col items-start justify-center gap-2 p-8 sm:h-64 lg:h-80">
        <span className="badge-accent">Limited Time</span>
        <h2 className="max-w-md text-2xl font-bold sm:text-4xl">{banner.title}</h2>
        {banner.subtitle && <p className="max-w-md text-sm text-primary-200 sm:text-base">{banner.subtitle}</p>}
        <span className="btn-accent mt-2">Shop Now</span>
      </Link>
      <button
        onClick={() => setIndex((i) => (i - 1 + banners.length) % banners.length)}
        className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        aria-label="Previous banner"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => setIndex((i) => (i + 1) % banners.length)}
        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        aria-label="Next banner"
      >
        <ChevronRight size={18} />
      </button>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {banners.map((_, i) => (
          <button key={i} onClick={() => setIndex(i)} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-accent' : 'w-1.5 bg-white/40'}`} aria-label={`Go to banner ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}

function FlashSaleWidget() {
  const { data, isLoading, isError, refetch } = useFlashSales();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissedIds(new Set());
  }, [data]);

  const visibleProducts = (data ?? []).filter((product) => !dismissedIds.has(product.id));
  const soonestEndsAt = visibleProducts[0]?.deal_ends_at ?? null;

  const handleExpire = (productId: string) => {
    setDismissedIds((prev) => new Set(prev).add(productId));
  };

  // A fetch error is shown, not silently treated as "no flash sale right now" (see ProductCarousel's
  // identical distinction below).
  if (!isLoading && !isError && visibleProducts.length === 0) return null;

  return (
    <section className="container-app py-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap size={20} className="fill-red-500 text-red-500" />
          <h2 className="text-xl font-bold text-primary-900 dark:text-white">Flash Sale</h2>
          {soonestEndsAt && <CountdownTimer endsAt={soonestEndsAt} />}
        </div>
        <Link to="/flash-sales" className="text-sm font-medium text-accent-600 hover:underline">
          View all
        </Link>
      </div>
      {isError ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-primary-50 py-8 text-center dark:bg-primary-800">
          <p className="text-sm text-primary-500 dark:text-primary-300">Couldn't load flash sale items.</p>
          <button onClick={() => refetch()} className="text-sm font-medium text-accent-600 hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-44 shrink-0 sm:w-52">
                  <ProductCardSkeleton />
                </div>
              ))
            : visibleProducts.map((product) => (
                <div key={product.id} className="w-44 shrink-0 sm:w-52">
                  <FlashSaleProductCard product={product} onExpire={handleExpire} />
                </div>
              ))}
        </div>
      )}
    </section>
  );
}

function PersonalizedRecommendations() {
  const { recommendations, topCategoryLabel, isLoading, isError, retry } = usePersonalizedRecommendations();

  if (!isLoading && !isError && recommendations.length === 0) return null;

  return (
    <div>
      <ProductCarousel
        title={
          <span className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" /> Recommended For You
          </span>
        }
        products={recommendations}
        isLoading={isLoading}
        isError={isError}
        onRetry={retry}
      />
      {topCategoryLabel && <p className="container-app -mt-6 pb-2 text-xs text-primary-400">Based on your interest in {topCategoryLabel}</p>}
    </div>
  );
}

function CategoryShowcase() {
  const { data: menCategories } = useCategories('men');
  const { data: kidsCategories } = useCategories('kids');
  const featured = [...(menCategories ?? []).slice(0, 6), ...(kidsCategories ?? []).slice(0, 2)];

  return (
    <section className="container-app py-6 sm:py-8">
      <h2 className="mb-4 text-xl font-bold">Shop by Category</h2>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {featured.map((category) => (
          <Link key={category.id} to={`/${category.gender}/${category.slug}`} className="group flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600 transition-colors group-hover:bg-accent group-hover:text-primary-900 sm:h-20 sm:w-20 dark:bg-primary-800 dark:text-primary-200">
              {category.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-center text-xs font-medium leading-tight">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeaturedBrandsStrip() {
  const { data: brands } = useFeaturedBrands();
  if (!brands?.length) return null;

  return (
    <section className="container-app py-6 sm:py-8">
      <h2 className="mb-4 text-xl font-bold">Featured Brands</h2>
      <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
        {brands.map((brand) => (
          <div key={brand.id} className="card-surface flex w-56 shrink-0 flex-col items-start gap-1 p-4">
            <p className="font-semibold">{brand.name}</p>
            <p className="text-xs text-primary-400">{brand.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DealsCountdown({ dealEndsAt }: { dealEndsAt: string | null | undefined }) {
  if (!dealEndsAt) return null;
  const hours = Math.max(0, Math.round((new Date(dealEndsAt).getTime() - Date.now()) / (1000 * 60 * 60)));
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-accent-600">
      <Clock size={12} /> Ends in {hours}h
    </span>
  );
}

function FeaturedCollections() {
  const { data: collections } = useFeaturedCollections();
  if (!collections?.length) return null;

  return (
    <section className="container-app py-6 sm:py-8">
      <h2 className="mb-4 text-xl font-bold">Featured Collections</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {collections.map((collection) => (
          <Link key={collection.slug} to={`/search?collection=${collection.slug}`} className="card-surface overflow-hidden p-4">
            <p className="mb-2 font-semibold">{collection.title}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {collection.products.slice(0, 4).map((p) => (
                <ProductImage key={p.id} src={p.coverImage || p.imageUrl || p.images[0]?.url} alt="" className="aspect-square rounded-lg" />
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const dealsQuery = useDealsOfTheDay();
  const trendingQuery = useTrendingProducts();
  const newArrivalsQuery = useNewArrivals();
  const topRatedQuery = useTopRated();
  const bestSellersQuery = useBestSellers();
  const { recentlyViewed, isLoading: isLoadingRecentlyViewed } = useRecentlyViewed();

  return (
    <div>
      <Seo title="Home" description="DressMart — premium online shopping for Men's and Kids' wear. Shop shirts, jeans, jackets, shoes and more." />
      <div className="container-app pt-6">
        <BannerSlider />
      </div>
      <FlashSaleWidget />
      <PersonalizedRecommendations />
      <CategoryShowcase />
      <FeaturedBrandsStrip />

      {/* Each carousel below distinguishes "confirmed empty" from "the query failed" (isError) —
          a fetch error used to be indistinguishable from zero results and silently rendered
          nothing, which is the actual mechanism behind whole sections going blank. */}
      {(dealsQuery.isLoading || dealsQuery.isError || (dealsQuery.data?.length ?? 0) > 0) && (
        <div>
          <ProductCarousel
            title="Deals of the Day"
            products={dealsQuery.data ?? []}
            isLoading={dealsQuery.isLoading}
            isError={dealsQuery.isError}
            onRetry={() => dealsQuery.refetch()}
            viewAllHref="/deals"
          />
          {dealsQuery.data && dealsQuery.data.length > 0 && (
            <div className="container-app -mt-6 flex justify-end pb-2">
              <DealsCountdown dealEndsAt={dealsQuery.data[0]?.deal_ends_at} />
            </div>
          )}
        </div>
      )}

      <ProductCarousel
        title="Trending Now"
        products={trendingQuery.data ?? []}
        isLoading={trendingQuery.isLoading}
        isError={trendingQuery.isError}
        onRetry={() => trendingQuery.refetch()}
      />
      <ProductCarousel
        title="New Arrivals"
        products={newArrivalsQuery.data ?? []}
        isLoading={newArrivalsQuery.isLoading}
        isError={newArrivalsQuery.isError}
        onRetry={() => newArrivalsQuery.refetch()}
        viewAllHref="/new-arrivals"
      />
      <ProductCarousel
        title="Top Rated"
        products={topRatedQuery.data ?? []}
        isLoading={topRatedQuery.isLoading}
        isError={topRatedQuery.isError}
        onRetry={() => topRatedQuery.refetch()}
      />
      <ProductCarousel
        title="Best Sellers"
        products={bestSellersQuery.data ?? []}
        isLoading={bestSellersQuery.isLoading}
        isError={bestSellersQuery.isError}
        onRetry={() => bestSellersQuery.refetch()}
        viewAllHref="/best-sellers"
      />

      <FeaturedCollections />

      {(isLoadingRecentlyViewed || recentlyViewed.length > 0) && (
        <ProductCarousel title="Recently Viewed" products={recentlyViewed} isLoading={isLoadingRecentlyViewed} />
      )}
    </div>
  );
}

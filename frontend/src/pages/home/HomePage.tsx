import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap, Truck, RotateCcw, ShieldCheck, Headphones, type LucideIcon } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { PullToRefresh } from '@/components/common/PullToRefresh';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { ProductGrid } from '@/components/product/ProductGrid';
import { FlashSaleProductCard } from '@/components/product/FlashSaleProductCard';
import { CountdownTimer } from '@/components/product/CountdownTimer';
import {
  useBanners,
  useCategories,
  useCategoryCoverImages,
  useFeaturedBrands,
  useFlashSales,
  useNewArrivals,
  useBestSellers,
} from '@/hooks/useProducts';
import { usePersonalizedRecommendations } from '@/hooks/usePersonalizedRecommendations';
import { Skeleton, ProductCardSkeleton } from '@/components/ui/Skeleton';
import { queryKeys } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

/**
 * Hero banner carousel — reads the exact same `banners` Firestore collection/hook as before
 * (see SellerBannersPage for how the Head Seller manages these), only the presentation changed:
 * fixed responsive heights, a left-aligned premium layout, and a real fade/slide transition
 * between slides.
 */
function BannerSlider() {
  const { data: banners, isLoading, isError } = useBanners();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  // Tracks banner ids whose image_url failed to load — falls back to the gradient background
  // (already always rendered on the outer div) instead of a broken-image icon, since there's no
  // dedicated "banner placeholder" asset the way products have one.
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!banners?.length) return;
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners]);

  if (isLoading) return <Skeleton className="h-[180px] w-full rounded-[20px] sm:h-[240px] lg:h-[380px]" />;
  // A fetch error is distinct from "no banners configured" — silently returning null here would
  // otherwise make the whole homepage banner section vanish on a transient query error.
  if (isError || !banners?.length) return null;

  const banner = banners[index];
  const showImage = Boolean(banner.image_url) && !failedIds.has(banner.id);

  const goTo = (next: number) => {
    setDirection(next > index || (index === banners.length - 1 && next === 0) ? 1 : -1);
    setIndex(((next % banners.length) + banners.length) % banners.length);
  };

  return (
    <div className="relative h-[180px] w-full overflow-hidden rounded-[20px] bg-gradient-to-br from-[#1F2937] to-[#111827] text-white shadow-card sm:h-[240px] lg:h-[380px]">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={banner.id}
          initial={{ opacity: 0, x: direction * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -direction * 40 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {showImage && (
            <>
              <img
                src={banner.image_url ?? undefined}
                alt=""
                loading="eager"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setFailedIds((prev) => new Set(prev).add(banner.id))}
              />
              {/* Dark gradient overlay, strongest on the left where the text sits, fading toward the right. */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#111827]/90 via-[#111827]/55 to-transparent" />
            </>
          )}
          <Link
            to={banner.link}
            className="relative flex h-full max-w-lg flex-col items-start justify-center gap-2 p-6 sm:gap-3 sm:p-10 lg:p-14"
          >
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#111827]">Limited Time</span>
            <h2 className="text-left text-xl font-bold leading-tight sm:text-3xl lg:text-5xl">{banner.title}</h2>
            {banner.subtitle && <p className="max-w-sm text-left text-xs text-white/80 sm:text-sm lg:text-base">{banner.subtitle}</p>}
            <span className="mt-1 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#111827] shadow-soft transition-transform duration-200 hover:scale-105 hover:bg-accent-400 sm:mt-3">
              Shop Now
            </span>
          </Link>
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-colors hover:bg-white/20"
            aria-label="Previous banner"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-colors hover:bg-white/20"
            aria-label="Next banner"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:bottom-5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn('h-1.5 rounded-full transition-all duration-300', i === index ? 'w-6 bg-accent' : 'w-1.5 bg-white/40 hover:bg-white/60')}
                aria-label={`Go to banner ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Circular category tiles, real product photography as the icon (see
 * categoryService.getCoverImages) rather than a generic icon or placeholder. A category is only
 * shown once a real product photo resolves for it (categories with zero remaining products never
 * get an entry in that map, so they're filtered out automatically) — and de-duped by slug as a
 * safeguard. Men's categories exclude Innerwear from this specific showcase (still fully
 * reachable via nav/filters); everything else comes straight from the same approved category list
 * used everywhere else in the app.
 */
function CategoryShowcase() {
  const { data: menCategories } = useCategories('men');
  const { data: kidsCategories } = useCategories('kids');
  const allCategories = useMemo(
    () => [...(menCategories ?? []).filter((c) => c.slug !== 'innerwear'), ...(kidsCategories ?? [])],
    [menCategories, kidsCategories],
  );
  const { data: coverImages, isLoading: isLoadingCovers } = useCategoryCoverImages(allCategories.map((c) => c.id));

  // Dedupe by slug (a category should be unique, but this is a cheap safeguard against any
  // upstream data duplication) and drop any category with no real product photo — i.e. no
  // products left in it — once the cover-image lookup has actually resolved.
  const categories = useMemo(() => {
    const seenSlugs = new Set<string>();
    return allCategories.filter((c) => {
      if (seenSlugs.has(c.slug)) return false;
      seenSlugs.add(c.slug);
      return isLoadingCovers || Boolean(coverImages?.[c.id]);
    });
  }, [allCategories, coverImages, isLoadingCovers]);

  if (categories.length === 0) return null;

  return (
    <section className="container-app py-6">
      <h2 className="mb-4 text-xl font-bold text-[#111827] dark:text-white">Shop by Category</h2>
      <div className="scrollbar-thin flex gap-5 overflow-x-auto pb-2 sm:gap-6">
        {categories.map((category) => (
          <Link key={category.id} to={`/${category.gender}/${category.slug}`} className="group flex w-[76px] shrink-0 flex-col items-center gap-2 sm:w-24">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-primary-100 shadow-soft ring-2 ring-transparent transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-card group-hover:ring-accent dark:bg-primary-800 sm:h-20 sm:w-20">
              {coverImages?.[category.id] ? (
                <img src={coverImages[category.id]} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="skeleton h-full w-full" />
              )}
            </div>
            <span className="text-center text-[11px] font-medium leading-tight text-[#111827] dark:text-primary-100 sm:text-xs">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
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
    <section className="bg-gradient-to-r from-red-50 via-accent-50 to-red-50 py-6 dark:from-red-950/20 dark:via-accent-900/10 dark:to-red-950/20">
      <div className="container-app">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap size={20} className="fill-red-500 text-red-500" />
            <h2 className="text-xl font-bold text-[#111827] dark:text-white">Flash Sale</h2>
            {soonestEndsAt && <CountdownTimer endsAt={soonestEndsAt} />}
          </div>
          <Link to="/flash-sales" className="text-sm font-medium text-accent-600 hover:underline">
            View all
          </Link>
        </div>
        {isError ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white py-8 text-center dark:bg-primary-800">
            <p className="text-sm text-primary-500 dark:text-primary-300">Couldn't load flash sale items.</p>
            <button onClick={() => refetch()} className="text-sm font-medium text-accent-600 hover:underline">
              Retry
            </button>
          </div>
        ) : (
          <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2 sm:gap-6">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-44 shrink-0 sm:w-52">
                    <ProductCardSkeleton />
                  </div>
                ))
              : visibleProducts.map((product) => (
                  <div key={product.id} className="w-44 shrink-0 sm:w-52">
                    <FlashSaleProductCard product={product} onExpire={handleExpire} showAddToCartButton />
                  </div>
                ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** New Arrivals uses a responsive grid (per spec) — everything else on the page stays a
 *  horizontal carousel. Same useNewArrivals query/data as before, just a different layout. */
function NewArrivalsGrid() {
  const { data, isLoading, isError, refetch } = useNewArrivals();
  if (!isLoading && !isError && (data?.length ?? 0) === 0) return null;

  return (
    <section className="container-app py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#111827] dark:text-white">New Arrivals</h2>
        <Link to="/new-arrivals" className="text-sm font-medium text-accent-600 hover:underline">
          View all
        </Link>
      </div>
      <ProductGrid products={data ?? []} isLoading={isLoading} isError={isError} onRetry={() => refetch()} showAddToCartButtons />
    </section>
  );
}

/** "Recommended for you" — built from recently-viewed/wishlist/orders/category-browsing/search
 *  history (see usePersonalizedRecommendations.ts + lib/personalizedRecommender.ts); no dedicated
 *  data fetch of its own here beyond that one hook. Title becomes "Because you searched for X" once
 *  a strongest-matched category is known, otherwise the generic "Recommended for you" — same
 *  "Recommended For You" wording already used on the Profile dashboard's version of this section. */
function PersonalizedForYouSection() {
  const { recommendations, topCategoryLabel, isLoading, isError, retry } = usePersonalizedRecommendations();
  if (!isLoading && !isError && recommendations.length === 0) return null;

  return (
    <ProductCarousel
      title={topCategoryLabel ? `Because you searched for ${topCategoryLabel}` : 'Recommended for you'}
      products={recommendations}
      isLoading={isLoading}
      isError={isError}
      onRetry={retry}
      showAddToCartButtons
    />
  );
}

function FeaturedBrandsSection() {
  const { data: brands } = useFeaturedBrands();
  if (!brands?.length) return null;

  return (
    <section className="container-app py-6">
      <h2 className="mb-4 text-xl font-bold text-[#111827] dark:text-white">Featured Brands</h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-6 lg:grid-cols-6">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            to={`/search?brands=${brand.id}`}
            className="flex h-20 items-center justify-center rounded-[20px] bg-white p-4 shadow-soft grayscale transition-all duration-200 hover:scale-[1.03] hover:shadow-card hover:grayscale-0 dark:bg-card-dark"
          >
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="max-h-10 max-w-full object-contain" />
            ) : (
              <span className="text-center text-sm font-bold text-[#111827] dark:text-primary-200">{brand.name}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

const WHY_SHOP_ITEMS: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Truck, title: 'Free Delivery', description: 'On orders above ₹999, delivered fast and reliably.' },
  { icon: RotateCcw, title: 'Easy Returns', description: '7-day hassle-free returns on eligible items.' },
  { icon: ShieldCheck, title: 'Secure Payments', description: 'Every transaction is encrypted and protected.' },
  { icon: Headphones, title: '24x7 Support', description: "Our support team's here whenever you need us." },
];

function WhyShopDressMart() {
  return (
    <section className="container-app py-6">
      <h2 className="mb-4 text-xl font-bold text-[#111827] dark:text-white">Why Shop DressMart</h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {WHY_SHOP_ITEMS.map(({ icon: Icon, title, description }) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center gap-2.5 rounded-[20px] bg-white p-5 text-center shadow-soft transition-shadow duration-200 hover:shadow-card dark:bg-card-dark sm:items-start sm:text-left"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
              <Icon size={20} />
            </div>
            <p className="font-semibold text-[#111827] dark:text-white">{title}</p>
            <p className="text-xs text-primary-500 dark:text-primary-300">{description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function HomePage() {
  const queryClient = useQueryClient();
  const bestSellersQuery = useBestSellers();

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.banners.all }),
    ]);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Seo title="Home" description="DressMart — premium online shopping for Men's and Kids' wear. Shop shirts, jeans, jackets, shoes and more." />
      <div className="container-app pt-6">
        <BannerSlider />
      </div>

      <CategoryShowcase />

      <FlashSaleWidget />

      <NewArrivalsGrid />

      <PersonalizedForYouSection />

      <ProductCarousel
        title="Best Sellers"
        products={bestSellersQuery.data ?? []}
        isLoading={bestSellersQuery.isLoading}
        isError={bestSellersQuery.isError}
        onRetry={() => bestSellersQuery.refetch()}
        viewAllHref="/best-sellers"
        showAddToCartButtons
      />

      <FeaturedBrandsSection />

      <WhyShopDressMart />
    </PullToRefresh>
  );
}

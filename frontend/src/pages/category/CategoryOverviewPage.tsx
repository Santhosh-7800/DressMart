import { Link } from 'react-router-dom';
import { Truck, Award, RotateCcw, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { Gender } from '@/types';
import { Seo } from '@/components/common/Seo';
import { useCategories, useCategoryCoverImages } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { useProductList } from '@/hooks/useProducts';

interface CategoryOverviewPageProps {
  gender: Gender;
  title: string;
}

const HERO_CONTENT: Record<
  Gender,
  {
    image: string;
    headline: [string, string];
    accentWord?: string;
    subtitle: string;
    features: { icon: LucideIcon; title: string; description: string }[];
  }
> = {
  men: {
    image: '/images/hero/men-hero.jpg',
    headline: ['Style That', 'Defines You'],
    subtitle: 'Premium Quality. Latest Trends. Made for Every You.',
    features: [
      { icon: Truck, title: 'Fast Delivery', description: 'At Your Doorstep' },
      { icon: Award, title: 'Premium Quality', description: 'Best in Class' },
      { icon: RotateCcw, title: 'Easy Returns', description: 'Hassle Free' },
      { icon: ShieldCheck, title: 'Secure Payment', description: '100% Safe' },
    ],
  },
  kids: {
    image: '/images/hero/kids-hero.jpg',
    headline: ['Style That', "They'll"],
    accentWord: 'Love',
    subtitle: 'Trendy Outfits. Premium Quality. Made for Fun. Made for Kids.',
    features: [
      { icon: Truck, title: 'Fast Delivery', description: 'At Your Doorstep' },
      { icon: Award, title: 'Premium Quality', description: 'Best for Kids' },
      { icon: RotateCcw, title: 'Easy Returns', description: 'Hassle Free' },
      { icon: ShieldCheck, title: 'Secure Payment', description: '100% Safe' },
    ],
  },
};

function CategoryHero({ gender }: { gender: Gender }) {
  const { image, headline, accentWord, subtitle, features } = HERO_CONTENT[gender];

  return (
    <section className="container-app pt-6">
      <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-primary-50 to-white shadow-card dark:from-primary-800 dark:to-primary-900">
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-center gap-5 p-6 sm:p-10 lg:p-14">
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-6 bg-accent" />
              <span className="text-xs font-bold uppercase tracking-wide text-accent-600">New Collection</span>
            </div>
            <h1 className="text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-[#111827] dark:text-white sm:text-5xl lg:text-6xl">
              {headline[0]}
              <br />
              {headline[1]}
              {accentWord && <> <span className="text-accent-600">{accentWord}</span></>}
            </h1>
            <p className="max-w-sm text-sm text-primary-500 dark:text-primary-300 sm:text-base">{subtitle}</p>
            <div className="flex flex-wrap gap-3">
              <a href="#category-grid" className="btn-accent">
                Shop Now
              </a>
              <a href="#category-grid" className="btn border-2 border-accent bg-transparent text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/20">
                Explore Collection
              </a>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:divide-x sm:divide-primary-200 dark:sm:divide-primary-700">
              {features.map(({ icon: Icon, title, description }, i) => (
                <div key={title} className={i > 0 ? 'flex flex-col gap-1 sm:pl-4' : 'flex flex-col gap-1'}>
                  <Icon size={22} className="text-[#111827] dark:text-white" />
                  <p className="text-xs font-semibold text-[#111827] dark:text-white">{title}</p>
                  <p className="text-[11px] text-primary-500 dark:text-primary-300">{description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[280px] sm:min-h-[360px] lg:min-h-[560px]">
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryOverviewPage({ gender, title }: CategoryOverviewPageProps) {
  const { data: categories, isLoading } = useCategories(gender);
  // Real product photo per category (same source as the homepage's "Shop by Category" tiles —
  // see CategoryShowcase in HomePage.tsx) instead of a two-letter initial placeholder.
  const { data: coverImages, isLoading: isLoadingCovers } = useCategoryCoverImages((categories ?? []).map((c) => c.id));
  const bestSellersQuery = useProductList({ gender, sort: 'popularity', pageSize: 12 });
  const newArrivalsQuery = useProductList({ gender, sort: 'newest', pageSize: 12 });

  return (
    <div>
      <Seo title={title} description={`Shop the latest ${title} collection at DressMart.`} />
      <CategoryHero gender={gender} />

      <div id="category-grid" className="container-app py-8">
        <h1 className="mb-6 text-2xl font-bold">{title}</h1>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {(categories ?? []).map((category) => (
              <Link key={category.id} to={`/${gender}/${category.slug}`} className="card-surface group flex flex-col items-center gap-3 p-5">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-primary-100 shadow-soft ring-2 ring-transparent transition-all group-hover:ring-accent dark:bg-primary-800">
                  {coverImages?.[category.id] ? (
                    <img src={coverImages[category.id]} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : isLoadingCovers ? (
                    <div className="skeleton h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-bold text-primary-600 dark:text-primary-200">
                      {category.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-center text-sm font-medium">{category.name}</span>
              </Link>
            ))}
          </div>
        )}

        <ProductCarousel title="Popular Right Now" products={bestSellersQuery.data?.items ?? []} isLoading={bestSellersQuery.isLoading} />
        <ProductCarousel title="New Arrivals" products={newArrivalsQuery.data?.items ?? []} isLoading={newArrivalsQuery.isLoading} />
      </div>
    </div>
  );
}

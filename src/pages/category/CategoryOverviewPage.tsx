import { Link } from 'react-router-dom';
import type { Gender } from '@/types';
import { Seo } from '@/components/common/Seo';
import { useCategories } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { useProductList } from '@/hooks/useProducts';

interface CategoryOverviewPageProps {
  gender: Gender;
  title: string;
}

export function CategoryOverviewPage({ gender, title }: CategoryOverviewPageProps) {
  const { data: categories, isLoading } = useCategories(gender);
  const bestSellersQuery = useProductList({ gender, sort: 'popularity', pageSize: 12 });
  const newArrivalsQuery = useProductList({ gender, sort: 'newest', pageSize: 12 });

  return (
    <div className="container-app py-8">
      <Seo title={title} description={`Shop the latest ${title} collection at DressMart.`} />
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
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-600 transition-colors group-hover:bg-accent group-hover:text-primary-900 dark:bg-primary-800 dark:text-primary-200">
                {category.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-center text-sm font-medium">{category.name}</span>
            </Link>
          ))}
        </div>
      )}

      <ProductCarousel title="Popular Right Now" products={bestSellersQuery.data?.items ?? []} isLoading={bestSellersQuery.isLoading} />
      <ProductCarousel title="New Arrivals" products={newArrivalsQuery.data?.items ?? []} isLoading={newArrivalsQuery.isLoading} />
    </div>
  );
}

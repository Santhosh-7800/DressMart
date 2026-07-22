import { useParams } from 'react-router-dom';
import { Heart, FolderHeart } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSharedWishlistCollection } from '@/hooks/useWishlistCollections';

export function SharedWishlistPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading } = useSharedWishlistCollection(token);

  if (isLoading) {
    return (
      <div className="container-app py-8">
        <Skeleton className="mb-6 h-8 w-1/3" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container-app py-12">
        <EmptyState icon={Heart} title="This wishlist link isn't available" description="It may have been unshared or the link is incorrect." actionLabel="Explore DressMart" actionHref="/" />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <Seo title={`${data.collection.name} — Shared Wishlist`} description={`A wishlist collection shared from DressMart: ${data.collection.name}.`} />
      <div className="mb-2 flex items-center gap-2">
        <FolderHeart size={22} className="text-accent" />
        <h1 className="text-xl font-bold sm:text-2xl">{data.collection.name}</h1>
      </div>
      <p className="mb-6 text-sm text-primary-400">Someone shared this wishlist collection with you.</p>

      <ProductGrid products={data.products} emptyMessage="This collection is currently empty." />
    </div>
  );
}

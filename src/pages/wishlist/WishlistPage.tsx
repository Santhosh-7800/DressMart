import { Heart } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { Avatar } from '@/components/ui/Avatar';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Product } from '@/types';

export function WishlistPage() {
  const { items, isLoading } = useWishlist();
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  const products = items.map((i) => i.product).filter(Boolean) as Product[];

  return (
    <div className="container-app py-8">
      <Seo title="Wishlist" description="Your saved items on DressMart." />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {user && <Avatar src={avatarUrl} name={user.full_name} size="sm" />}
          <h1 className="text-2xl font-bold">My Wishlist ({products.length})</h1>
        </div>
      </div>
      {!isLoading && products.length === 0 ? (
        <EmptyState icon={Heart} title="Your wishlist is empty" description="Save items you love and find them here anytime." actionLabel="Start Shopping" actionHref="/" />
      ) : (
        <ProductGrid products={products} isLoading={isLoading} />
      )}
    </div>
  );
}

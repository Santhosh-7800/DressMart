import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { Product } from '@/types';
import { PriceTag } from '@/components/ui/PriceTag';
import { Rating } from '@/components/ui/Rating';
import { ProductImage } from '@/components/ui/ProductImage';
import { useWishlist } from '@/hooks/useWishlist';
import { useInventory } from '@/hooks/useInventory';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { isWishlisted, toggle } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  // Stock lives in its own inventory doc, not on Product — see types/database.ts. Loading/missing
  // inventory is treated as "in stock" rather than blocking the card on an extra round-trip.
  const { data: inventory } = useInventory(product.id);
  // coverImage (first image, denormalized) is the fast-path thumbnail source; fall back to the
  // pre-existing chain for older seed data that never got a coverImage populated.
  const primaryImage = product.coverImage || product.thumbnailUrl || product.imageUrl || product.images[0]?.url;
  // A seller can mark a product out_of_stock explicitly (still buyer-visible per is_active) even
  // before the inventory doc itself reads zero — check both so the badge never lags.
  const isOutOfStock = product.status === 'out_of_stock' || (inventory !== undefined && inventory !== null && inventory.total_stock <= 0);

  return (
    <motion.div
      className={cn('card-surface group relative overflow-hidden', className)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          toggle(product.id);
        }}
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform hover:scale-110 dark:bg-primary-800/90"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart size={15} className={cn(wishlisted ? 'fill-red-500 text-red-500' : 'text-primary-400')} />
      </button>

      {product.discount_percent > 0 && (
        <span className="badge-accent absolute left-2 top-2 z-10">{product.discount_percent}% OFF</span>
      )}

      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative overflow-hidden">
          <ProductImage
            src={primaryImage}
            alt={product.images[0]?.alt ?? product.name}
            className="aspect-[4/5] w-full bg-primary-50 dark:bg-primary-800"
            imgClassName={cn('transition-transform duration-300 group-hover:scale-105', isOutOfStock && 'opacity-50 grayscale')}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-950/40">
              <span className="rounded-full bg-primary-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Out of Stock</span>
            </div>
          )}
        </div>
        <div className="space-y-1 p-3">
          <p className="truncate text-xs font-medium text-primary-400">{product.brand?.name}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-primary-900 dark:text-white">{product.name}</h3>
          <Rating value={product.rating} count={product.rating_count} showValue />
          <PriceTag price={product.price} mrp={product.mrp} size="sm" />
          {isOutOfStock && <p className="text-xs font-semibold text-red-500">Out of stock</p>}
        </div>
      </Link>
    </motion.div>
  );
}

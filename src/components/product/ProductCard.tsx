import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { Product } from '@/types';
import { PriceTag } from '@/components/ui/PriceTag';
import { Rating } from '@/components/ui/Rating';
import { ProductImage } from '@/components/ui/ProductImage';
import { useWishlist } from '@/hooks/useWishlist';
import { useRatingSummary } from '@/hooks/useProducts';
import { CompareToggle } from './CompareToggle';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { isWishlisted, toggle } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const { data: ratingSummary } = useRatingSummary(product.id);
  const primaryImage = product.thumbnailUrl ?? product.imageUrl ?? product.images[0]?.url;
  const isOutOfStock = product.total_stock <= 0;

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
        <ProductImage
          src={primaryImage}
          alt={product.images[0]?.alt ?? product.name}
          className="aspect-[4/5] w-full bg-primary-50 dark:bg-primary-800"
          imgClassName={cn('transition-transform duration-300 group-hover:scale-105', isOutOfStock && 'opacity-50 grayscale')}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
        <div className="space-y-1 p-3">
          <p className="truncate text-xs font-medium text-primary-400">{product.brand?.name}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-primary-900 dark:text-white">{product.name}</h3>
          <Rating value={ratingSummary?.average_rating ?? 0} count={ratingSummary?.total_reviews ?? 0} showValue />
          <PriceTag price={product.price} mrp={product.mrp} size="sm" />
          {isOutOfStock && <p className="text-xs font-semibold text-red-500">Out of stock</p>}
          <CompareToggle productId={product.id} className="mt-1" />
        </div>
      </Link>
    </motion.div>
  );
}

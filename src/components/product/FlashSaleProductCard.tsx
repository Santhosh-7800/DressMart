import { memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { Product } from '@/types';
import { PriceTag } from '@/components/ui/PriceTag';
import { Rating } from '@/components/ui/Rating';
import { ProductImage } from '@/components/ui/ProductImage';
import { useWishlist } from '@/hooks/useWishlist';
import { useInventory } from '@/hooks/useInventory';
import { productService } from '@/services/productService';
import { queryKeys } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { CountdownTimer } from './CountdownTimer';
import { StockIndicator } from './StockIndicator';

interface FlashSaleProductCardProps {
  product: Product;
  onExpire?: (productId: string) => void;
  className?: string;
}

/**
 * "Flash Sale" has no distinct fields in the new data model (see productService.getFlashSales,
 * which aliases it to Deal of the Day) — stock/countdown here come from the real inventory doc and
 * product.deal_ends_at instead of the old flash_sale_total_stock/claimed/ends_at fields.
 */
function FlashSaleProductCardImpl({ product, onExpire, className }: FlashSaleProductCardProps) {
  const { isWishlisted, toggle } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const { data: inventory } = useInventory(product.id);
  const queryClient = useQueryClient();
  const primaryImage = product.coverImage || product.thumbnailUrl || product.imageUrl || product.images[0]?.url;

  const totalStock = inventory?.total_stock ?? 0;
  const isSoldOut = inventory !== undefined && inventory !== null && totalStock <= 0;

  const prefetchDetails = useCallback(() => {
    queryClient.prefetchQuery({ queryKey: queryKeys.products.detail(product.slug), queryFn: () => productService.getBySlug(product.slug) });
  }, [queryClient, product.slug]);

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

      {product.discount_percent > 0 && <span className="badge-accent absolute left-2 top-2 z-10">{product.discount_percent}% OFF</span>}

      <Link to={`/product/${product.slug}`} className="block" onMouseEnter={prefetchDetails} onFocus={prefetchDetails}>
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-primary-50 dark:bg-primary-800">
          <ProductImage
            src={primaryImage}
            alt={product.images[0]?.alt ?? product.name}
            className="h-full w-full"
            imgClassName={cn('transition-transform duration-300 group-hover:scale-105', isSoldOut && 'opacity-50 grayscale')}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          />
          {isSoldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-950/40">
              <span className="rounded-full bg-primary-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Sold Out</span>
            </div>
          )}
        </div>
        <div className="space-y-1.5 p-3">
          <p className="truncate text-xs font-medium text-primary-400">{product.brand?.name}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-primary-900 dark:text-white">{product.name}</h3>
          <Rating value={product.rating} count={product.rating_count} showValue />
          <PriceTag price={product.price} mrp={product.mrp} size="sm" />
          <CountdownTimer endsAt={product.deal_ends_at} onExpire={() => onExpire?.(product.id)} />
          {inventory && <StockIndicator claimed={Math.max(0, totalStock - inventory.low_stock_threshold)} total={totalStock} />}
        </div>
      </Link>
    </motion.div>
  );
}

export const FlashSaleProductCard = memo(FlashSaleProductCardImpl);

import { memo, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Product } from '@/types';
import { PriceTag } from '@/components/ui/PriceTag';
import { Rating } from '@/components/ui/Rating';
import { ProductImage } from '@/components/ui/ProductImage';
import { useWishlist } from '@/hooks/useWishlist';
import { useInventory } from '@/hooks/useInventory';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { productService } from '@/services/productService';
import { queryKeys } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { CountdownTimer } from './CountdownTimer';
import { StockIndicator } from './StockIndicator';

interface FlashSaleProductCardProps {
  product: Product;
  onExpire?: (productId: string) => void;
  className?: string;
  /** Shows a full-width labeled "Add to Cart" button — opt-in, unset on the dedicated Flash
   *  Sales page (/flash-sales), only enabled from the homepage's premium card treatment. */
  showAddToCartButton?: boolean;
}

/**
 * "Flash Sale" has no distinct fields in the new data model (see productService.getFlashSales,
 * which aliases it to Deal of the Day) — stock/countdown here come from the real inventory doc and
 * product.deal_ends_at instead of the old flash_sale_total_stock/claimed/ends_at fields.
 */
function FlashSaleProductCardImpl({ product, onExpire, className, showAddToCartButton }: FlashSaleProductCardProps) {
  const { isWishlisted, toggle } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const { data: inventory } = useInventory(product.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const primaryImage = product.coverImage || product.thumbnailUrl || product.imageUrl || product.images[0]?.url;

  const totalStock = inventory?.total_stock ?? 0;
  const isSoldOut = inventory !== undefined && inventory !== null && totalStock <= 0;

  // Same "skip color/size selection, grab the first in-stock variant" shortcut as ProductCard's
  // quick add — see that component's doc comment for the full rationale.
  const quickAddVariant = useMemo(() => {
    if (product.variants.length === 0) return undefined;
    if (!inventory) return product.variants[0];
    return product.variants.find((v) => (inventory.variant_stock[v.id] ?? 0) > 0);
  }, [product.variants, inventory]);

  const prefetchDetails = useCallback(() => {
    queryClient.prefetchQuery({ queryKey: queryKeys.products.detail(product.slug), queryFn: () => productService.getBySlug(product.slug) });
  }, [queryClient, product.slug]);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/product/${product.slug}` } });
      return;
    }
    if (!quickAddVariant) return;
    await addItem({ productId: product.id, variantId: quickAddVariant.id });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast('Please log in to save items to your wishlist');
      navigate('/login', { state: { from: `/product/${product.slug}` } });
      return;
    }
    toggle(product.id);
  };

  return (
    <motion.div
      className={cn('card-surface group relative overflow-hidden', className)}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <button
        onClick={handleToggleWishlist}
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform hover:scale-110 active:scale-95 dark:bg-primary-800/90"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wishlisted}
      >
        <Heart size={15} className={cn(wishlisted ? 'fill-red-500 text-red-500' : 'text-primary-900 dark:text-white')} />
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
      {showAddToCartButton && !isSoldOut && (
        <div className="px-3 pb-3">
          <button onClick={handleAddToCart} disabled={!quickAddVariant} className="btn-accent w-full !py-2 text-xs">
            <ShoppingCart size={14} /> Add to Cart
          </button>
        </div>
      )}
    </motion.div>
  );
}

export const FlashSaleProductCard = memo(FlashSaleProductCardImpl);

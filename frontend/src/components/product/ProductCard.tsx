import { memo, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Product, Inventory } from '@/types';
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
import { debugLog } from '@/lib/debugLog';

interface ProductCardProps {
  product: Product;
  className?: string;
  /** Pre-fetched inventory from a parent's batched query (ProductGrid/ProductCarousel fetch stock
   *  for every visible product in one call rather than each card fetching its own). When
   *  `skipOwnFetch` is true, this card trusts the parent entirely and never fires its own read —
   *  `undefined` here then just means "parent's batch hasn't resolved yet", same as the existing
   *  loading semantics below. Callers that render a card outside such a container (Wishlist,
   *  Profile previews, etc.) omit both props and get the original one-card-one-fetch behavior. */
  inventory?: Inventory | null;
  skipOwnFetch?: boolean;
  /** Shows a full-width labeled "Add to Cart" button below the price instead of the small
   *  floating quick-add icon. Opt-in (default false/unset) — every existing page keeps the
   *  compact icon-only quick add exactly as before; only the homepage's premium card treatment
   *  passes this. */
  showAddToCartButton?: boolean;
  /** 0-100 visual-search similarity score (see lib/visualSearchMatch.ts) — renders a small "N%
   *  Match" badge when present. Omitted everywhere except visual search results. */
  similarityScore?: number;
}

function ProductCardImpl({ product, className, inventory: inventoryProp, skipOwnFetch, showAddToCartButton, similarityScore }: ProductCardProps) {
  debugLog('ProductCard', 'render', product.id, product.slug);
  const { isWishlisted, toggle } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  // Stock lives in its own inventory doc, not on Product — see types/database.ts. Loading/missing
  // inventory is treated as "in stock" rather than blocking the card on an extra round-trip.
  const { data: fetchedInventory } = useInventory(product.id, !skipOwnFetch);
  const inventory = skipOwnFetch ? inventoryProp : fetchedInventory;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();

  // Quick-add from the card skips color/size selection — it grabs the first variant that's
  // actually in stock (falling back to the first variant while inventory is still loading, same
  // "assume in stock" convention as the stock badge below) rather than opening the PDP just to
  // pick a size for a single-variant product. Shoppers who DO need to pick color/size still tap
  // through to the PDP as normal; this button is a shortcut, not a replacement.
  const quickAddVariant = useMemo(() => {
    if (product.variants.length === 0) return undefined;
    if (!inventory) return product.variants[0];
    return product.variants.find((v) => (inventory.variant_stock[v.id] ?? 0) > 0);
  }, [product.variants, inventory]);
  // coverImage (first image, denormalized) is the fast-path thumbnail source; fall back to the
  // pre-existing chain for older seed data that never got a coverImage populated.
  const primaryImage = product.coverImage || product.thumbnailUrl || product.imageUrl || product.images[0]?.url;
  // Second photo of the SAME colorway (never a different color's photo, which would misrepresent
  // what hovering "shows more of") — e.g. a front view swapping to a back/detail shot on hover.
  // Undefined when the product only has one photo for that color, in which case no swap happens.
  const primaryColor = product.images[0]?.color ?? null;
  const hoverImage = product.images.filter((img) => img.color === primaryColor)[1];
  // A seller can mark a product out_of_stock explicitly (still buyer-visible per is_active) even
  // before the inventory doc itself reads zero — check both so the badge never lags.
  const isOutOfStock = product.status === 'out_of_stock' || (inventory !== undefined && inventory !== null && inventory.total_stock <= 0);

  // Warms the Product Details query cache while the shopper is still deciding whether to click —
  // by the time navigation actually happens, the page renders from cache instantly instead of
  // waiting on a fresh Firestore round-trip. Cheap/idempotent: prefetchQuery no-ops if the slug's
  // data is already fresh in the cache (default staleTime), so hovering the same card repeatedly
  // (or a card already visited) doesn't refetch.
  const prefetchDetails = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(product.slug),
      queryFn: () => productService.getBySlug(product.slug),
    });
  }, [queryClient, product.slug]);

  const handleQuickAdd = async (e: React.MouseEvent) => {
    // Nested inside the card's <Link> — without stopping propagation, the click would also bubble
    // up to the anchor and navigate to the PDP at the same time as adding to cart.
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
        className="tap-target-48 !absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-transform hover:scale-110 active:scale-95 dark:bg-primary-800/90"
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wishlisted}
      >
        <Heart size={15} className={cn(wishlisted ? 'fill-red-500 text-red-500' : 'text-primary-900 dark:text-white')} />
      </button>

      {product.discount_percent > 0 && (
        <span className="badge-accent absolute left-2 top-2 z-10">{product.discount_percent}% OFF</span>
      )}

      <Link to={`/product/${product.slug}`} className="block" onMouseEnter={prefetchDetails} onFocus={prefetchDetails}>
        <div className="relative overflow-hidden">
          <ProductImage
            src={primaryImage}
            alt={product.images[0]?.alt ?? product.name}
            className={cn('aspect-[4/5] w-full bg-primary-50 dark:bg-primary-800', hoverImage && 'transition-opacity duration-300 group-hover:opacity-0')}
            imgClassName={cn('transition-transform duration-300 group-hover:scale-105', isOutOfStock && 'opacity-50 grayscale')}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          />
          {hoverImage && (
            <ProductImage
              src={hoverImage.url}
              alt={hoverImage.alt ?? product.name}
              className="absolute inset-0 aspect-[4/5] w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              imgClassName="transition-transform duration-300 group-hover:scale-105"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            />
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-950/40">
              <span className="rounded-full bg-primary-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Out of Stock</span>
            </div>
          )}
          {similarityScore !== undefined && (
            <span className="absolute bottom-2 left-2 z-10 rounded-full bg-primary-900/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              {Math.round(similarityScore)}% Match
            </span>
          )}
        </div>
        <div className="space-y-1 p-3">
          <p className="truncate text-xs font-medium text-primary-400">{product.brand?.name}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-primary-900 dark:text-white">{product.name}</h3>
          <Rating value={product.rating} count={product.rating_count} showValue />
          <div className="flex items-center justify-between gap-2">
            <PriceTag price={product.price} mrp={product.mrp} size="sm" />
            {!isOutOfStock && !showAddToCartButton && (
              <button
                onClick={handleQuickAdd}
                disabled={!quickAddVariant}
                className="tap-target-48 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary-900 shadow-sm transition-transform hover:scale-110 disabled:opacity-40"
                aria-label="Add to cart"
                title="Add to cart"
              >
                <ShoppingCart size={14} />
              </button>
            )}
          </div>
          {isOutOfStock && <p className="text-xs font-semibold text-red-500">Out of stock</p>}
        </div>
      </Link>
      {showAddToCartButton && !isOutOfStock && (
        <div className="px-3 pb-3">
          <button onClick={handleQuickAdd} disabled={!quickAddVariant} className="btn-accent w-full !py-2 text-xs">
            <ShoppingCart size={14} /> Add to Cart
          </button>
        </div>
      )}
    </motion.div>
  );
}

/** Memoized — a grid renders dozens of these, and TanStack Query returns structurally-stable
 *  `product` references across unrelated re-renders (e.g. a cart update elsewhere on the page), so
 *  this reliably skips re-rendering cards whose own data hasn't changed. */
export const ProductCard = memo(ProductCardImpl);

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Share2, Truck, RotateCcw, ShieldCheck, ChevronDown, Info, AlertTriangle, Store } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ColorSwatches } from '@/components/product/ColorSwatches';
import { SizeSelector } from '@/components/product/SizeSelector';
import { PincodeChecker } from '@/components/product/PincodeChecker';
import { CompleteTheLook } from '@/components/product/CompleteTheLook';
import { SizeRecommender } from '@/components/product/SizeRecommender';
import { PriceTag } from '@/components/ui/PriceTag';
import { Rating } from '@/components/ui/Rating';
import { Button } from '@/components/ui/Button';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { ReviewsSummary } from '@/components/product/ReviewsSummary';
import { ReviewCard } from '@/components/product/ReviewCard';
import { WriteReviewForm } from '@/components/product/WriteReviewForm';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductImage } from '@/components/ui/ProductImage';
import { useFrequentlyBoughtTogether, useProduct, useProductRealtime, useRatingSummary, useRelatedProducts, useReviews } from '@/hooks/useProducts';
import { useInventoryRealtime } from '@/hooks/useInventory';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, estimatedDeliveryFor } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { productViewService } from '@/services/productViewService';
import { setBuyNowItem } from '@/lib/buyNowSession';

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-primary-100 py-4 dark:border-primary-700">
      <button onClick={() => setIsOpen((v) => !v)} className="flex w-full items-center justify-between text-left font-medium">
        {title}
        <ChevronDown size={16} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {isOpen && <div className="mt-3 text-sm text-primary-600 dark:text-primary-300">{children}</div>}
    </div>
  );
}

export function ProductDetailsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  // First paint comes from the cache-backed getBySlug query; once that resolves an id, the
  // realtime subscription below takes over as the source of truth, so a seller's price/status/
  // image/color/stock-threshold edit shows up live without a refetch or page refresh.
  const { data: initialProduct, isLoading } = useProduct(slug);
  const { data: liveProduct } = useProductRealtime(initialProduct?.id);
  const product = liveProduct ?? initialProduct;
  const relatedQuery = useRelatedProducts(product);
  const fbtQuery = useFrequentlyBoughtTogether(product);
  const reviewsQuery = useReviews(product?.id);
  const ratingSummaryQuery = useRatingSummary(product?.id);
  // Realtime — a shopper deciding to buy should see stock change immediately if someone else checks out first.
  const { data: inventory } = useInventoryRealtime(product?.id);
  const { recordView, recentlyViewed, isLoading: isLoadingRecentlyViewed } = useRecentlyViewed();
  const { addItem } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const { isAuthenticated } = useAuth();
  const [pincode, setPincode] = useLocalStorage('dressmart:pincode', '400001');

  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      recordView(product.id);
      productViewService.recordView(product.id);
      setActiveColor(product.variants[0]?.color ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const colors = useMemo(() => {
    if (!product) return [];
    const seen = new Map<string, { hex: string; image?: string }>();
    product.variants.forEach((v) => {
      if (!seen.has(v.color)) {
        const colorImg = product.images.find((img) => img.color === v.color)?.url || product.images[0]?.url || product.coverImage;
        seen.set(v.color, { hex: v.color_hex, image: colorImg });
      }
    });
    return Array.from(seen.entries()).map(([name, { hex, image }]) => ({ name, hex, image }));
  }, [product]);

  const sizesForColor = useMemo(() => {
    if (!product || !activeColor) return [];
    const threshold = inventory?.low_stock_threshold ?? 5;
    // While inventory is still loading, assume in-stock rather than flashing every size as
    // sold-out for a frame — the realtime subscription corrects this the instant it resolves.
    return product.variants
      .filter((v) => v.color === activeColor)
      .map((v) => {
        const stockCount = inventory?.variant_stock[v.id] ?? 0;
        const inStock = inventory === undefined ? true : stockCount > 0;
        return { size: v.size, inStock, stockCount, isLowStock: inStock && stockCount > 0 && stockCount <= threshold };
      });
  }, [product, activeColor, inventory]);

  const activeVariant = useMemo(
    () => product?.variants.find((v) => v.color === activeColor && v.size === activeSize),
    [product, activeColor, activeSize],
  );

  if (isLoading) {
    return (
      <div className="container-app py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-[4/5] w-full" />
          <div className="space-y-4">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Covers both "never existed" (initial getBySlug fetch came back empty) and "removed while the
  // buyer was looking at it" (the realtime subscription's next snapshot reports the doc gone).
  if (!product) {
    return (
      <div className="container-app py-16 text-center">
        <p className="text-lg font-semibold">Product not found</p>
        <p className="mt-1 text-sm text-primary-400">This product may have been removed or is no longer available.</p>
        <Button className="mt-4" onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  // Overall product-level unavailability — a seller can mark the whole product out_of_stock (or
  // every variant can independently read zero) even if the per-selected-variant stock below looks
  // fine for a stale selection; either condition must block checkout, not just an empty variant.
  const productUnavailable = product.status === 'out_of_stock' || (inventory !== undefined && inventory !== null && inventory.total_stock <= 0);
  const activeVariantStock = activeVariant ? (inventory?.variant_stock[activeVariant.id] ?? 0) : 0;
  const lowStockThreshold = inventory?.low_stock_threshold ?? 5;
  const isActiveVariantLowStock = activeVariantStock > 0 && activeVariantStock <= lowStockThreshold;
  const canTransact = !productUnavailable && (!activeVariant || activeVariantStock > 0);

  /** Shared validation for both Add to Cart and Buy Now — login, then color, then size, then stock,
   *  in that order, matching the spec exactly. Returns the variant to transact with, or null (after
   *  showing the relevant toast/redirect) if something failed. */
  const validateForPurchase = (): boolean => {
    if (!isAuthenticated) {
      toast.error('Please sign in to continue');
      navigate('/login', { state: { from: `/product/${product.slug}` } });
      return false;
    }
    if (productUnavailable) {
      toast.error('This product is currently out of stock');
      return false;
    }
    if (!activeColor) {
      toast.error('Please select a color');
      return false;
    }
    if (!activeSize) {
      toast.error('Please select a size');
      return false;
    }
    if (!activeVariant || activeVariantStock <= 0) {
      toast.error('This size is out of stock');
      return false;
    }
    return true;
  };

  const handleAddToCart = async () => {
    if (!validateForPurchase() || !activeVariant) return;
    await addItem({ productId: product.id, variantId: activeVariant.id });
  };

  /**
   * Buy Now bypasses the persistent cart entirely — a temporary, session-scoped checkout for
   * exactly this one item (see lib/buyNowSession.ts), so it never mixes with whatever else is
   * already in the cart. Checkout/Payment read it via useCheckoutItems() and clear it once the
   * order is placed.
   */
  const handleBuyNow = () => {
    if (!validateForPurchase() || !activeVariant) return;
    setBuyNowItem({ productId: product.id, variantId: activeVariant.id, quantity: 1 });
    navigate('/checkout');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: product.name, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Product link copied to clipboard');
    }
  };

  return (
    <div className="container-app pt-6 pb-24 md:pb-6">
      <Seo title={product.name} description={product.description} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery
          images={product.images}
          videoUrl={product.video_url}
          activeColor={activeColor}
          productName={product.name}
        />

        <div>
          <p className="text-sm font-medium text-primary-400">{product.brand?.name}</p>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">{product.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <Rating value={ratingSummaryQuery.data?.average_rating ?? 0} count={ratingSummaryQuery.data?.total_reviews ?? 0} showValue />
            <button onClick={handleShare} className="ml-auto flex items-center gap-1 text-sm text-primary-400 hover:text-primary-700 dark:hover:text-white">
              <Share2 size={15} /> Share
            </button>
          </div>

          <div className="mt-4">
            <PriceTag price={activeVariant?.price_override ?? product.price} mrp={product.mrp} discountPercent={product.discount_percent} size="lg" />
            <p className="mt-1 text-xs text-primary-400">Inclusive of all taxes</p>
            {product.seller_name && (
              <p className="mt-1 flex items-center gap-1 text-xs text-primary-400">
                <Store size={12} /> Sold by <span className="font-medium text-primary-600 dark:text-primary-300">{product.seller_name}</span>
              </p>
            )}
          </div>

          <div className="mt-6 space-y-5">
            <ColorSwatches colors={colors} activeColor={activeColor ?? ''} onChange={(c) => { setActiveColor(c); setActiveSize(null); }} />
            <SizeSelector sizes={sizesForColor} activeSize={activeSize} onChange={setActiveSize} gender={product.gender} />
            <SizeRecommender
              sizes={sizesForColor.map((s) => s.size)}
              stockBySize={Object.fromEntries(sizesForColor.map((s) => [s.size, s.inStock ? 1 : 0]))}
              onSelectSize={setActiveSize}
            />
          </div>

          {/* Stock-status banner for the currently selected color+size combo (or the product as a
              whole, when it's unavailable outright) — the buttons below stay in sync with this. */}
          {productUnavailable ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle size={16} /> Out of Stock — this product is currently unavailable
            </div>
          ) : activeVariant && activeVariantStock <= 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle size={16} /> This size is out of stock
            </div>
          ) : activeVariant && isActiveVariantLowStock ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertTriangle size={16} /> Low Stock — only {activeVariantStock} left
            </div>
          ) : activeVariant ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              In Stock
            </div>
          ) : null}

          {product.cod_available === false && (
            <div className="mt-3 flex items-center gap-2 text-xs text-primary-400">
              <Info size={13} /> Cash on Delivery is not available for this item
            </div>
          )}

          <div className="mt-6 hidden gap-3 md:flex">
            {productUnavailable ? (
              <div className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary-100 text-sm font-semibold text-red-500 dark:bg-primary-800">
                Out of Stock
              </div>
            ) : (
              <>
                <Button variant="outline" size="lg" fullWidth onClick={handleAddToCart} disabled={!canTransact}>
                  Add to Cart
                </Button>
                <Button variant="accent" size="lg" fullWidth onClick={handleBuyNow} disabled={!canTransact}>
                  Buy Now
                </Button>
              </>
            )}
            <button
              onClick={() => toggle(product.id)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary-200 dark:border-primary-600"
              aria-label="Toggle wishlist"
            >
              <Heart size={18} className={isWishlisted(product.id) ? 'fill-red-500 text-red-500' : ''} />
            </button>
          </div>

          <div className="mt-6 rounded-2xl bg-primary-50 p-4 dark:bg-primary-800">
            <div className="flex items-center gap-3 text-sm">
              <Truck size={18} className="text-primary-500" />
              <div className="flex-1">
                <p className="font-medium">Delivery by {formatDate(estimatedDeliveryFor(pincode))}</p>
                <p className="mb-2 text-xs text-primary-400">to {pincode}</p>
                <PincodeChecker onVerified={setPincode} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <RotateCcw size={18} className="text-primary-500" />
              <p>7-day easy return &amp; exchange</p>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <ShieldCheck size={18} className="text-primary-500" />
              <p>100% authentic products, secure payments</p>
            </div>
          </div>

          <div className="mt-4">
            <Accordion title="Product Description" defaultOpen>
              <p>{product.description}</p>
            </Accordion>
            <Accordion title="Specifications">
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-primary-400">Fabric</dt>
                <dd>{product.specifications.fabric}</dd>
                <dt className="text-primary-400">Fit</dt>
                <dd>{product.specifications.fit}</dd>
                {product.specifications.pattern && (
                  <>
                    <dt className="text-primary-400">Pattern</dt>
                    <dd>{product.specifications.pattern}</dd>
                  </>
                )}
                {product.specifications.sleeve && (
                  <>
                    <dt className="text-primary-400">Sleeve</dt>
                    <dd>{product.specifications.sleeve}</dd>
                  </>
                )}
                {product.specifications.collar && (
                  <>
                    <dt className="text-primary-400">Collar</dt>
                    <dd>{product.specifications.collar}</dd>
                  </>
                )}
                {product.specifications.occasion && (
                  <>
                    <dt className="text-primary-400">Occasion</dt>
                    <dd>{product.specifications.occasion}</dd>
                  </>
                )}
                <dt className="text-primary-400">Country of Origin</dt>
                <dd>{product.specifications.country_of_origin}</dd>
              </dl>
            </Accordion>
            {product.specifications.wash_care && (
              <Accordion title="Wash Care">
                <p>{product.specifications.wash_care}</p>
              </Accordion>
            )}
            <Accordion title="Return Policy">
              <p>This item is eligible for free returns within 7 days of delivery. Refunds are processed within 5-7 business days after we receive the returned item.</p>
            </Accordion>
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar — mirrors the inline buttons above (hidden on mobile via
          md:flex there) so the primary purchase actions stay reachable without scrolling back up,
          matching every native Android shopping app's PDP pattern. Sits just above the global
          BottomNavBar (bottom-16 == BottomNavBar's own reserved height, see MainLayout's pb-16). */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-primary-100 bg-surface p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden dark:border-primary-700 dark:bg-surface-dark">
        <div className="flex gap-2">
          <button
            onClick={() => toggle(product.id)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary-200 dark:border-primary-600"
            aria-label="Toggle wishlist"
          >
            <Heart size={18} className={isWishlisted(product.id) ? 'fill-red-500 text-red-500' : ''} />
          </button>
          {productUnavailable ? (
            <div className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary-100 text-sm font-semibold text-red-500 dark:bg-primary-800">
              Out of Stock
            </div>
          ) : (
            <>
              <Button variant="outline" size="md" fullWidth onClick={handleAddToCart} disabled={!canTransact}>
                Add to Cart
              </Button>
              <Button variant="accent" size="md" fullWidth onClick={handleBuyNow} disabled={!canTransact}>
                Buy Now
              </Button>
            </>
          )}
        </div>
      </div>

      <CompleteTheLook product={product} />

      {fbtQuery.data && fbtQuery.data.length > 0 && (
        <section className="mt-10 border-t border-primary-100 pt-8 dark:border-primary-700">
          <h2 className="mb-4 text-xl font-bold">Frequently Bought Together</h2>
          <div className="flex flex-wrap items-center gap-4">
            {[product, ...fbtQuery.data].map((p) => (
              <ProductImage
                key={p.id}
                src={p.coverImage || p.imageUrl || p.images[0]?.url}
                alt={p.name}
                className="h-28 w-24 rounded-lg border border-primary-100 dark:border-primary-700"
                priority
              />
            ))}
            <Button variant="accent">Add all to Cart</Button>
          </div>
        </section>
      )}

      <section className="mt-10 border-t border-primary-100 pt-8 dark:border-primary-700">
        <h2 className="mb-4 text-xl font-bold">Ratings &amp; Reviews</h2>

        {ratingSummaryQuery.data && ratingSummaryQuery.data.total_reviews > 0 ? (
          <ReviewsSummary summary={ratingSummaryQuery.data} />
        ) : (
          <p className="text-sm text-primary-400">No customer reviews yet. Be the first to review this product.</p>
        )}

        <div className="mt-6">
          <WriteReviewForm productId={product.id} />
        </div>

        <div className="mt-6">
          {(reviewsQuery.data ?? []).map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </section>

      <ProductCarousel title="Related Products" products={relatedQuery.data ?? []} isLoading={relatedQuery.isLoading} />
      {(() => {
        const otherRecentlyViewed = recentlyViewed.filter((p) => p.id !== product.id);
        return (
          (isLoadingRecentlyViewed || otherRecentlyViewed.length > 0) && (
            <ProductCarousel title="Recently Viewed" products={otherRecentlyViewed} isLoading={isLoadingRecentlyViewed} />
          )
        );
      })()}
    </div>
  );
}

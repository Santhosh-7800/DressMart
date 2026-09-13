import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { Heart, Share2, Truck, RotateCcw, ShieldCheck, ChevronDown, Info, AlertTriangle, Store, Search, Tag, Gift, PackageCheck } from 'lucide-react';
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
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import {
  useBestSellers,
  useFrequentlyBoughtTogether,
  useProduct,
  useProductRealtime,
  useRatingSummary,
  useRelatedProducts,
  useReviews,
  useTopRated,
} from '@/hooks/useProducts';
import { useInventoryRealtime } from '@/hooks/useInventory';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useCoupons } from '@/hooks/useCoupons';
import { useDefaultAddress } from '@/hooks/useDefaultAddress';
import { usePlatformSettings } from '@/hooks/useDashboardData';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, estimatedDeliveryFor } from '@/lib/utils';
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
  const bestSellersQuery = useBestSellers();
  const topRatedQuery = useTopRated();
  const reviewsQuery = useReviews(product?.id);
  const ratingSummaryQuery = useRatingSummary(product?.id);
  const [reviewSearch, setReviewSearch] = useState('');
  // Realtime — a shopper deciding to buy should see stock change immediately if someone else checks out first.
  const { data: inventory } = useInventoryRealtime(product?.id);
  const { recordView, recentlyViewed, isLoading: isLoadingRecentlyViewed } = useRecentlyViewed();
  const { addItem } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const { isAuthenticated } = useAuth();
  const [pincode, setPincode] = useLocalStorage('dressmart:pincode', '400001');
  const { data: coupons } = useCoupons();
  const { defaultAddress } = useDefaultAddress();
  const { data: platformSettings } = usePlatformSettings();

  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

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

  // Client-side filter over the already-fetched review list — matches "Looking for specific info?"
  // style review search without needing a separate search index/query for what's already loaded.
  const filteredReviews = useMemo(() => {
    const reviews = reviewsQuery.data ?? [];
    const query = reviewSearch.trim().toLowerCase();
    if (!query) return reviews;
    return reviews.filter(
      (r) => (r.review_title ?? '').toLowerCase().includes(query) || (r.review_text ?? '').toLowerCase().includes(query),
    );
  }, [reviewsQuery.data, reviewSearch]);

  // Reset quantity whenever the selected variant changes — a quantity valid for one size/color's
  // stock could otherwise silently carry over and exceed a different variant's availability.
  useEffect(() => {
    setQuantity(1);
  }, [activeVariant?.id]);

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

  const displayPrice = activeVariant?.price_override ?? product.price;
  /** Real, currently-active coupons (see couponService) that apply to this product — platform-wide
   *  ones (no applicable_categories) plus any scoped to this product's category. */
  const applicableCoupons = (coupons ?? []).filter(
    (c) => !c.applicable_categories?.length || c.applicable_categories.includes(product.category_id),
  );
  const freeDeliveryThreshold = platformSettings?.free_shipping_threshold ?? 999;
  const qualifiesForFreeDelivery = displayPrice >= freeDeliveryThreshold;
  /** Cosmetic loyalty-points teaser only — DressMart has no wallet/redemption system yet, so this is
   *  deliberately framed as a point count rather than a "worth ₹X cash" claim (which would be a
   *  concrete, unbacked promise to a real buyer). */
  const rewardPoints = Math.round(displayPrice * 0.05);

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
    await addItem({ productId: product.id, variantId: activeVariant.id, quantity });
  };

  /**
   * Buy Now bypasses the persistent cart entirely — a temporary, session-scoped checkout for
   * exactly this one item (see lib/buyNowSession.ts), so it never mixes with whatever else is
   * already in the cart. Checkout/Payment read it via useCheckoutItems() and clear it once the
   * order is placed.
   */
  const handleBuyNow = () => {
    if (!validateForPurchase() || !activeVariant) return;
    setBuyNowItem({ productId: product.id, variantId: activeVariant.id, quantity });
    navigate('/checkout');
  };

  /** Converts a fetched image Blob to the raw base64 string Filesystem.writeFile expects (no
   *  `data:...;base64,` prefix — see visualSearchService's compressToBase64 for the same trick). */
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleShare = async () => {
    const url = window.location.href;
    const priceLine =
      displayPrice < product.mrp ? `${formatCurrency(displayPrice)} (MRP ${formatCurrency(product.mrp)})` : formatCurrency(displayPrice);
    const text = `${product.name} — ${priceLine}\nCheck it out on DressMart!`;

    if (Capacitor.isNativePlatform()) {
      // The native share sheet (WhatsApp, Instagram, ...) only accepts a local file:// URI for an
      // attached image, never a remote URL — so the cover image is downloaded into the app's cache
      // first. If that fails for any reason, fall back to a plain text+link share rather than
      // blocking sharing altogether.
      let fileUri: string | undefined;
      try {
        const imageUrl = product.coverImage || product.images[0]?.url;
        if (imageUrl) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const blob = await (await fetch(imageUrl)).blob();
          const base64 = await blobToBase64(blob);
          const path = `share-${product.id}.jpg`;
          await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
          fileUri = (await Filesystem.getUri({ path, directory: Directory.Cache })).uri;
        }
      } catch {
        // Image download/cache-write failed — share without an attached image below.
      }

      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: product.name, text, url, ...(fileUri ? { files: [fileUri] } : {}) });
      } catch {
        // User cancelled the share sheet — nothing to show.
      }
      return;
    }

    if (navigator.share) {
      await navigator.share({ title: product.name, text, url });
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
            <PriceTag price={displayPrice} mrp={product.mrp} discountPercent={product.discount_percent} size="lg" />
            <p className="mt-1 text-xs text-primary-400">Inclusive of all taxes</p>
            {product.seller_name && (
              <p className="mt-1 flex items-center gap-1 text-xs text-primary-400">
                <Store size={12} /> Sold by <span className="font-medium text-primary-600 dark:text-primary-300">{product.seller_name}</span>
              </p>
            )}
            {rewardPoints > 0 && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Gift size={13} /> Earn {rewardPoints} DressMart Coins on this order
              </p>
            )}
          </div>

          {applicableCoupons.length > 0 && (
            <div className="mt-4 rounded-2xl bg-primary-50 p-3 dark:bg-primary-800">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Tag size={15} className="text-primary-500" /> Offers for you
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {applicableCoupons.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="w-56 shrink-0 rounded-xl border border-primary-200 bg-white p-3 text-xs dark:border-primary-600 dark:bg-primary-900"
                  >
                    <p className="font-bold text-primary-700 dark:text-white">{c.code}</p>
                    <p className="mt-0.5 text-primary-500 dark:text-primary-300">{c.description}</p>
                    {c.min_order_value > 0 && <p className="mt-1 text-primary-400">Min. order {formatCurrency(c.min_order_value)}</p>}
                  </div>
                ))}
              </div>
              <Link to="/coupons" className="mt-2 inline-block text-sm font-medium text-accent-600 hover:underline dark:text-accent-400">
                See all offers
              </Link>
            </div>
          )}

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

          {!productUnavailable && activeVariant && activeVariantStock > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-medium text-primary-500">Quantity</span>
              <QuantitySelector value={quantity} onChange={setQuantity} max={Math.min(activeVariantStock, 10)} />
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
                {defaultAddress && defaultAddress.pincode === pincode ? (
                  <p className="mb-2 text-xs text-primary-400">
                    Deliver to <span className="font-medium text-primary-600 dark:text-primary-300">{defaultAddress.full_name}</span> — {defaultAddress.city} {pincode}
                  </p>
                ) : (
                  <p className="mb-2 text-xs text-primary-400">to {pincode}</p>
                )}
                <PincodeChecker onVerified={setPincode} />
              </div>
            </div>

            <p className="mt-4 mb-2 text-xs font-semibold text-primary-500">Shop with confidence</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="shrink-0 text-primary-500" />
                <span>7-day return &amp; exchange</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck size={16} className="shrink-0 text-primary-500" />
                <span>{qualifiesForFreeDelivery ? 'Free delivery' : `Free delivery above ${formatCurrency(freeDeliveryThreshold)}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-primary-500" />
                <span>100% authentic products</span>
              </div>
              <div className="flex items-center gap-2">
                <PackageCheck size={16} className="shrink-0 text-primary-500" />
                <span>{product.cod_available === false ? 'Secure prepaid payments' : 'Cash on Delivery available'}</span>
              </div>
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
          BottomNavBar — bottom-nav-safe accounts for the nav's safe-area-inset-bottom padding
          (see index.css), not just its 64px base height, so this doesn't tuck under a taller nav
          on gesture-nav/notched devices. */}
      <div className="bottom-nav-safe fixed inset-x-0 z-30 border-t border-primary-100 bg-surface p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden dark:border-primary-700 dark:bg-surface-dark">
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
          <>
            <ReviewsSummary summary={ratingSummaryQuery.data} />
            <div className="relative mt-4 max-w-md">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-300" />
              <input
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                placeholder="Search reviews (e.g. fit, quality, size)"
                aria-label="Search reviews"
                className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-9 pr-3 text-sm text-primary-900 placeholder:text-primary-300 focus:border-accent dark:border-primary-600 dark:bg-primary-800 dark:text-white dark:placeholder:text-primary-400"
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-primary-400">No customer reviews yet. Be the first to review this product.</p>
        )}

        <div className="mt-6">
          <WriteReviewForm productId={product.id} />
        </div>

        <div className="mt-6">
          {filteredReviews.length === 0 && reviewSearch.trim() ? (
            <p className="text-sm text-primary-400">No reviews match "{reviewSearch}".</p>
          ) : (
            filteredReviews.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </div>
      </section>

      <ProductCarousel title="Related Products" products={relatedQuery.data ?? []} isLoading={relatedQuery.isLoading} />
      <ProductCarousel
        title="Best Sellers You Might Like"
        products={(bestSellersQuery.data ?? []).filter((p) => p.id !== product.id)}
        isLoading={bestSellersQuery.isLoading}
      />
      <ProductCarousel
        title="Top Rated Picks"
        products={(topRatedQuery.data ?? []).filter((p) => p.id !== product.id)}
        isLoading={topRatedQuery.isLoading}
      />
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

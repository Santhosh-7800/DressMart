import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Share2, Truck, RotateCcw, ShieldCheck, ChevronDown, Camera } from 'lucide-react';
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
import { useFrequentlyBoughtTogether, useProduct, useRatingSummary, useRelatedProducts, useReviews } from '@/hooks/useProducts';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { formatDate } from '@/lib/utils';
import { estimatedDeliveryFor } from '@/lib/catalogGenerator';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { productViewService } from '@/services/productViewService';

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
  const { data: product, isLoading } = useProduct(slug);
  const relatedQuery = useRelatedProducts(product);
  const fbtQuery = useFrequentlyBoughtTogether(product);
  const reviewsQuery = useReviews(product?.id);
  const ratingSummaryQuery = useRatingSummary(product?.id);
  const { recordView, recentlyViewed, isLoading: isLoadingRecentlyViewed } = useRecentlyViewed();
  const { addItem } = useCart();
  const { isWishlisted, toggle } = useWishlist();
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
    const seen = new Map<string, string>();
    product.variants.forEach((v) => seen.set(v.color, v.color_hex));
    return Array.from(seen.entries()).map(([name, hex]) => ({ name, hex }));
  }, [product]);

  const sizesForColor = useMemo(() => {
    if (!product || !activeColor) return [];
    return product.variants
      .filter((v) => v.color === activeColor)
      .map((v) => ({ size: v.size, inStock: v.stock > 0 }));
  }, [product, activeColor]);

  const activeVariant = useMemo(
    () => product?.variants.find((v) => v.color === activeColor && v.size === activeSize),
    [product, activeColor, activeSize],
  );

  if (isLoading || !product) {
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

  const handleAddToCart = async () => {
    if (!activeSize) {
      toast.error('Please select a size');
      return;
    }
    if (!activeVariant || activeVariant.stock <= 0) {
      toast.error('This size is out of stock');
      return;
    }
    await addItem({ productId: product.id, variantId: activeVariant.id });
  };

  const handleBuyNow = async () => {
    if (!activeSize) {
      toast.error('Please select a size');
      return;
    }
    if (!activeVariant || activeVariant.stock <= 0) {
      toast.error('This size is out of stock');
      return;
    }
    await addItem({ productId: product.id, variantId: activeVariant.id });
    navigate('/cart');
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
    <div className="container-app py-6">
      <Seo title={product.name} description={product.description} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery
          images={product.images}
          videoUrl={product.video_url}
          spinFrames={product.spin_frames}
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
          </div>

          <div className="mt-6 space-y-5">
            <ColorSwatches colors={colors} activeColor={activeColor ?? ''} onChange={(c) => { setActiveColor(c); setActiveSize(null); }} />
            <SizeSelector sizes={sizesForColor} activeSize={activeSize} onChange={setActiveSize} />
            <SizeRecommender
              sizes={sizesForColor.map((s) => s.size)}
              stockBySize={Object.fromEntries(sizesForColor.map((s) => [s.size, s.inStock ? 1 : 0]))}
              onSelectSize={setActiveSize}
            />
          </div>

          <div className="mt-6 flex gap-3">
            {product.total_stock <= 0 ? (
              <div className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary-100 text-sm font-semibold text-red-500 dark:bg-primary-800">
                Out of Stock
              </div>
            ) : (
              <>
                <Button variant="outline" size="lg" fullWidth onClick={handleAddToCart}>
                  Add to Cart
                </Button>
                <Button variant="accent" size="lg" fullWidth onClick={handleBuyNow}>
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

          <Link to={`/try-on/${product.slug}`} className="btn-outline mt-3 w-full">
            <Camera size={16} /> Try It On Virtually
          </Link>

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
                <dt className="text-primary-400">Material</dt>
                <dd>{product.specifications.material}</dd>
                <dt className="text-primary-400">Fit</dt>
                <dd>{product.specifications.fit}</dd>
                {product.specifications.pattern && (
                  <>
                    <dt className="text-primary-400">Pattern</dt>
                    <dd>{product.specifications.pattern}</dd>
                  </>
                )}
                <dt className="text-primary-400">Country of Origin</dt>
                <dd>{product.specifications.country_of_origin}</dd>
              </dl>
            </Accordion>
            <Accordion title="Wash Care">
              <p>{product.specifications.wash_care}</p>
            </Accordion>
            <Accordion title="Return Policy">
              <p>This item is eligible for free returns within 7 days of delivery. Refunds are processed within 5-7 business days after we receive the returned item.</p>
            </Accordion>
          </div>
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
                src={p.imageUrl ?? p.images[0]?.url}
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

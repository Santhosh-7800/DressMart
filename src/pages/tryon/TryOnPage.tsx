import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ShoppingBag, Sparkles } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useProduct } from '@/hooks/useProducts';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useCart } from '@/hooks/useCart';
import { TryOnCanvas, type TryOnCanvasHandle, type TryOnTransform } from '@/components/tryon/TryOnCanvas';
import { TryOnControls } from '@/components/tryon/TryOnControls';
import { ColorSwatches } from '@/components/product/ColorSwatches';
import { Button } from '@/components/ui/Button';
import { PriceTag } from '@/components/ui/PriceTag';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductImage } from '@/components/ui/ProductImage';

const DEFAULT_TRANSFORM: TryOnTransform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.92 };

export function TryOnPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug);
  const upload = useImageUpload();
  const { addItem } = useCart();
  const canvasRef = useRef<TryOnCanvasHandle>(null);

  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [transform, setTransform] = useState<TryOnTransform>(DEFAULT_TRANSFORM);

  const colors = useMemo(() => {
    if (!product) return [];
    const seen = new Map<string, string>();
    product.variants.forEach((v) => seen.set(v.color, v.color_hex));
    return Array.from(seen.entries()).map(([name, hex]) => ({ name, hex }));
  }, [product]);

  const effectiveColor = activeColor ?? colors[0]?.name ?? null;

  const garmentImage = useMemo(() => {
    if (!product) return null;
    return product.images.find((img) => img.color === effectiveColor) ?? product.images[0] ?? null;
  }, [product, effectiveColor]);

  const handleAddToCart = async () => {
    if (!product) return;
    const variant = product.variants.find((v) => v.color === effectiveColor && v.stock > 0) ?? product.variants.find((v) => v.stock > 0);
    if (!variant) {
      toast.error('This product is currently out of stock');
      return;
    }
    await addItem({ productId: product.id, variantId: variant.id });
  };

  if (isLoading || !product) {
    return (
      <div className="container-app py-8">
        <Skeleton className="mb-6 h-8 w-1/3" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-6">
      <Seo title={`Virtual Try-On — ${product.name}`} description={`See how ${product.name} looks on you with DressMart's virtual try-on.`} />

      <Link to={`/product/${product.slug}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-900 dark:hover:text-white">
        <ArrowLeft size={15} /> Back to product
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <Sparkles size={20} className="text-accent" />
        <h1 className="text-xl font-bold sm:text-2xl">Virtual Try-On</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {garmentImage && (
            <TryOnCanvas
              ref={canvasRef}
              photoUrl={upload.imageUrl}
              isDragging={upload.isDragging}
              uploadError={upload.error}
              onFileSelect={upload.setFile}
              onDrop={upload.handleDrop}
              onDragOver={upload.handleDragOver}
              onDragLeave={upload.handleDragLeave}
              garmentUrl={garmentImage.url}
              garmentAlt={garmentImage.alt}
              transform={transform}
              onTransformChange={setTransform}
            />
          )}
          {upload.imageUrl && (
            <button onClick={upload.reset} className="mt-3 text-sm text-accent-600 hover:underline">
              Upload a different photo
            </button>
          )}
          <p className="mt-3 text-xs text-primary-400">
            This is a styling preview to help you visualize fit and color — not a precise body-fitted render.
          </p>
        </div>

        <div className="space-y-4">
          <div className="card-surface p-4">
            <div className="flex gap-3">
              <ProductImage src={product.imageUrl ?? product.images[0]?.url} alt={product.name} className="h-20 w-16 shrink-0 rounded-lg" priority />
              <div className="min-w-0">
                <p className="text-xs text-primary-400">{product.brand?.name}</p>
                <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                <PriceTag price={product.price} mrp={product.mrp} size="sm" className="mt-1" />
              </div>
            </div>

            {colors.length > 0 && (
              <div className="mt-4">
                <ColorSwatches colors={colors} activeColor={effectiveColor ?? ''} onChange={setActiveColor} />
              </div>
            )}

            <Button variant="accent" fullWidth className="mt-4" onClick={handleAddToCart}>
              <ShoppingBag size={15} /> Add to Cart
            </Button>
          </div>

          {upload.imageUrl && (
            <TryOnControls
              scale={transform.scale}
              rotation={transform.rotation}
              opacity={transform.opacity}
              onScaleChange={(scale) => setTransform((t) => ({ ...t, scale }))}
              onRotationChange={(rotation) => setTransform((t) => ({ ...t, rotation }))}
              onOpacityChange={(opacity) => setTransform((t) => ({ ...t, opacity }))}
              onReset={() => setTransform(DEFAULT_TRANSFORM)}
              onDownload={() => canvasRef.current?.download()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

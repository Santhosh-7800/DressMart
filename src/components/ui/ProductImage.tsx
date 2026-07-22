import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared static fallback shown whenever a product has no photo yet, or its photo fails to load. */
export const FALLBACK_IMAGE_SRC = '/images/placeholder-shirt.webp';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  /** Sizes/positions the outer wrapper (e.g. "aspect-[4/5] w-full"). */
  className?: string;
  /** Extra classes for the <img> itself, e.g. a hover-zoom transform driven by a `.group` ancestor. */
  imgClassName?: string;
  /** Passed straight through to the <img> for responsive art direction, e.g. "(min-width: 1024px) 25vw, 50vw". */
  sizes?: string;
  srcSet?: string;
  /** Enables a hover-magnify zoom (desktop only) — used on the main product-details image, not on small cards. */
  zoom?: boolean;
  /** Disables lazy-loading for above-the-fold images (e.g. the first product card in a grid). */
  priority?: boolean;
}

/**
 * Reusable product photo renderer: skeleton while loading, a two-tier fallback if the image is
 * missing or fails to load (first the shared placeholder-shirt.webp, then — only if that's also
 * unavailable — a generic icon so the UI never breaks), lazy loading, and a smooth fade-in once
 * loaded. Consumers only ever pass a URL — swapping a real photo in later requires no code changes.
 */
export function ProductImage({ src, alt, className, imgClassName, sizes, srcSet, zoom = false, priority = false }: ProductImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(src || FALLBACK_IMAGE_SRC);
  const [usedFallback, setUsedFallback] = useState(!src);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZooming, setIsZooming] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Re-arm loading/error state when the image source itself changes (e.g. switching color variant).
  useEffect(() => {
    setCurrentSrc(src || FALLBACK_IMAGE_SRC);
    setUsedFallback(!src);
    setStatus('loading');
  }, [src]);

  // Cached images (very common here — a handful of real photos are reused across many products)
  // can finish loading before the onLoad listener below attaches, so the event never fires. This
  // closes that gap by checking the already-rendered <img>'s own load state directly.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setStatus('loaded');
  }, [currentSrc]);

  const handleError = () => {
    if (!usedFallback) {
      // The real photo 404'd (or doesn't exist yet) — drop to the shared placeholder image.
      setUsedFallback(true);
      setCurrentSrc(FALLBACK_IMAGE_SRC);
      setStatus('loading');
    } else {
      // Even the placeholder image is unavailable — last resort, a plain icon.
      setStatus('error');
    }
  };

  if (status === 'error') {
    return (
      <div className={cn('flex items-center justify-center bg-primary-50 dark:bg-primary-800', className)}>
        <ImageOff size={28} className="text-primary-300 dark:text-primary-600" />
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onMouseMove={
        zoom
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setZoomPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
            }
          : undefined
      }
      onMouseEnter={zoom ? () => setIsZooming(true) : undefined}
      onMouseLeave={zoom ? () => setIsZooming(false) : undefined}
    >
      {status === 'loading' && <div className="skeleton absolute inset-0" />}
      {/* Always rendered at full opacity — visibility must never depend on React state timing,
          Framer Motion animation scheduling, or hover. The skeleton above provides the loading
          visual and unmounts on its own once the image is ready. */}
      <img
        ref={imgRef}
        src={currentSrc}
        srcSet={usedFallback ? undefined : srcSet}
        sizes={sizes}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={handleError}
        draggable={false}
        className={cn('h-full w-full select-none object-cover opacity-100', imgClassName)}
      />
      {zoom && isZooming && status === 'loaded' && (
        <div
          className="pointer-events-none absolute inset-0 hidden bg-no-repeat sm:block"
          style={{ backgroundImage: `url(${currentSrc})`, backgroundSize: '200%', backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%` }}
        />
      )}
    </div>
  );
}

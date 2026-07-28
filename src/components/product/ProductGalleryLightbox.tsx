import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, PlayCircle, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { GalleryItem } from './galleryTypes';
import { Product360Viewer } from './Product360Viewer';
import { resolveSwipeDirection } from '@/lib/gesture';
import { cn, clamp } from '@/lib/utils';
import { ProductImage, FALLBACK_IMAGE_SRC } from '@/components/ui/ProductImage';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const TAP_ZOOM = 2.2;

function touchDistance(touches: React.TouchList): number {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

interface ProductGalleryLightboxProps {
  items: GalleryItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  productName: string;
}

export function ProductGalleryLightbox({ items, index, onIndexChange, onClose, productName }: ProductGalleryLightboxProps) {
  // A continuous scale (not a binary zoomed/not-zoomed flag) so a real two-finger pinch can land on
  // any zoom level, not just one fixed jump — tap-to-toggle (desktop, or a quick mobile fallback)
  // still exists, it just targets a fixed TAP_ZOOM level instead of being the only way to zoom.
  const [scale, setScale] = useState(1);
  const isZoomed = scale > 1.05;
  const pinchRef = useRef<{ initialDistance: number; initialScale: number } | null>(null);
  const [erroredIds, setErroredIds] = useState<Set<string>>(new Set());
  const stageRef = useRef<HTMLDivElement>(null);
  const activeItem = items[index];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goTo(index - 1);
      if (e.key === 'ArrowRight') goTo(index + 1);
    };
    window.addEventListener('keydown', handleKeydown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeydown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, onClose]);

  useEffect(() => {
    setScale(1);
    pinchRef.current = null;
  }, [index]);

  const goTo = (next: number) => {
    if (next < 0 || next >= items.length) return;
    onIndexChange(next);
  };

  const handleSwipeEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const direction = resolveSwipeDirection(info.offset.x, info.velocity.x);
    if (direction === 'left') goTo(index + 1);
    if (direction === 'right') goTo(index - 1);
  };

  /** Real two-finger pinch — tracks the ratio of current-to-initial finger distance against the
   *  scale pinch started at, so it composes with repeated pinch gestures instead of always
   *  starting back from 1x. Framer's `drag` prop only understands single-pointer gestures, so this
   *  bypasses it entirely with plain touch events; `touchAction: none` on the image (below) stops
   *  the browser's own native pinch-zoom from fighting this one over the same gesture. */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { initialDistance: touchDistance(e.touches), initialScale: scale };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const ratio = touchDistance(e.touches) / pinchRef.current.initialDistance;
      setScale(clamp(pinchRef.current.initialScale * ratio, MIN_ZOOM, MAX_ZOOM));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
      setScale((s) => (s < 1.05 ? 1 : s));
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="gallery-lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 flex flex-col bg-primary-950/95 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
          <p className="text-sm font-medium text-white/80">
            {index + 1} / {items.length}
          </p>
          <button onClick={onClose} aria-label="Close gallery" className="rounded-full p-1.5 hover:bg-white/10">
            <X size={22} />
          </button>
        </div>

        <div ref={stageRef} className="relative flex-1 overflow-hidden">
          {activeItem.type === 'image' && (
            <div className="flex h-full w-full items-center justify-center overflow-hidden">
              <motion.img
                key={activeItem.id}
                src={erroredIds.has(activeItem.id) ? FALLBACK_IMAGE_SRC : activeItem.url}
                alt={activeItem.alt}
                drag={isZoomed ? true : 'x'}
                dragConstraints={isZoomed ? stageRef : { left: 0, right: 0 }}
                dragElastic={isZoomed ? 0.15 : 0.6}
                onDragEnd={isZoomed ? undefined : handleSwipeEnd}
                onClick={() => setScale((s) => (s > 1.05 ? 1 : TAP_ZOOM))}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                animate={{ scale }}
                transition={pinchRef.current ? { duration: 0 } : { duration: 0.25 }}
                draggable={false}
                onError={() => setErroredIds((prev) => (prev.has(activeItem.id) ? prev : new Set(prev).add(activeItem.id)))}
                style={{ touchAction: 'none' }}
                className={cn('max-h-full max-w-full select-none object-contain', isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in')}
              />
            </div>
          )}

          {activeItem.type === 'video' && (
            <div className="flex h-full w-full items-center justify-center">
              <video src={activeItem.url} controls autoPlay className="max-h-full max-w-full" />
            </div>
          )}

          {activeItem.type === '360' && (
            <div className="flex h-full w-full items-center justify-center p-6 sm:p-16">
              <div className="aspect-[4/5] h-full max-h-[70vh]">
                <Product360Viewer frames={activeItem.frames} alt={productName} />
              </div>
            </div>
          )}

          {items.length > 1 && (
            <>
              <button
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                aria-label="Previous"
                className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30 sm:flex sm:left-4"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={() => goTo(index + 1)}
                disabled={index === items.length - 1}
                aria-label="Next"
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30 sm:flex sm:right-4"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {activeItem.type === 'image' && (
            <button
              onClick={() => setScale((s) => (s > 1.05 ? 1 : TAP_ZOOM))}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 sm:bottom-5 sm:right-5"
            >
              {isZoomed ? <ZoomOut size={14} /> : <ZoomIn size={14} />} {isZoomed ? 'Zoom out' : 'Zoom in'}
            </button>
          )}
        </div>

        {items.length > 1 && (
          <div className="scrollbar-thin flex gap-2 overflow-x-auto px-4 py-3 sm:justify-center sm:px-6">
            {items.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => goTo(idx)}
                className={cn(
                  'relative aspect-[4/5] h-14 shrink-0 overflow-hidden rounded-lg border-2 bg-primary-800 sm:h-16',
                  idx === index ? 'border-accent' : 'border-transparent',
                )}
              >
                {item.type === 'image' && <ProductImage src={item.url} alt="" className="h-full w-full" priority />}
                {item.type === 'video' && (
                  <div className="flex h-full w-full items-center justify-center">
                    <PlayCircle className="text-white" size={18} />
                  </div>
                )}
                {item.type === '360' && (
                  <>
                    <ProductImage src={item.frames[0]} alt="" className="h-full w-full" priority />
                    <div className="absolute inset-0 flex items-center justify-center bg-primary-950/30">
                      <RotateCw className="text-white" size={18} />
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

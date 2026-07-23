import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { Maximize2, PlayCircle, RotateCw } from 'lucide-react';
import type { ProductImage } from '@/types';
import { cn } from '@/lib/utils';
import { resolveSwipeDirection } from '@/lib/gesture';
import type { GalleryItem } from './galleryTypes';
import { Product360Viewer } from './Product360Viewer';
import { ProductGalleryLightbox } from './ProductGalleryLightbox';
import { ProductImage as ProductPhoto } from '@/components/ui/ProductImage';

interface ProductGalleryProps {
  images: ProductImage[];
  videoUrl?: string | null;
  spinFrames?: string[];
  activeColor?: string | null;
  productName: string;
}

export function ProductGallery({ images, videoUrl, spinFrames, activeColor, productName }: ProductGalleryProps) {
  /**
   * Strictly scoped to the active color — a color's gallery must NEVER show another color's
   * photos. If the active color has no images of its own, fall back only to the shared/uncolored
   * pool (`color: null` — a single-color product's photos, or genuinely color-agnostic shots),
   * never to another color's specifically-tagged images.
   */
  const filteredImages = useMemo(() => {
    if (!activeColor) return images;
    const ownImages = images.filter((img) => img.color === activeColor);
    if (ownImages.length > 0) return ownImages;
    return images.filter((img) => !img.color);
  }, [images, activeColor]);

  const items: GalleryItem[] = useMemo(() => {
    const list: GalleryItem[] = filteredImages.map((img) => ({ type: 'image', id: img.id, url: img.url, alt: img.alt }));
    if (spinFrames && spinFrames.length > 0) list.push({ type: '360', id: 'spin-360', frames: spinFrames });
    if (videoUrl) list.push({ type: 'video', id: 'product-video', url: videoUrl });
    return list;
  }, [filteredImages, spinFrames, videoUrl]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [isZooming, setIsZooming] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeColor]);

  const activeItem = items[Math.min(activeIndex, items.length - 1)];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= items.length) return;
    setActiveIndex(next);
  };

  const handleSwipeEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const direction = resolveSwipeDirection(info.offset.x, info.velocity.x);
    if (direction === 'left') goTo(activeIndex + 1);
    if (direction === 'right') goTo(activeIndex - 1);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[80px_1fr]">
      <div className="scrollbar-thin order-2 flex gap-2 overflow-x-auto pb-1 sm:order-1 sm:max-h-[560px] sm:flex-col sm:overflow-y-auto sm:overflow-x-visible sm:pb-0">
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => setActiveIndex(idx)}
            aria-label={item.type === 'image' ? item.alt : item.type === 'video' ? 'Product video' : '360° view'}
            className={cn(
              'relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-primary-50 dark:bg-primary-800 sm:w-auto',
              activeIndex === idx ? 'border-accent' : 'border-transparent',
            )}
          >
            {item.type === 'image' && <ProductPhoto src={item.url} alt={item.alt} className="h-full w-full" priority />}
            {item.type === 'video' && (
              <div className="flex h-full w-full items-center justify-center bg-primary-800">
                <PlayCircle className="text-white" size={22} />
              </div>
            )}
            {item.type === '360' && (
              <>
                <ProductPhoto src={item.frames[0]} alt="360° view" className="h-full w-full" priority />
                <div className="absolute inset-0 flex items-center justify-center bg-primary-950/30">
                  <RotateCw className="text-white" size={20} />
                </div>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="order-1 sm:order-2">
        <div
          ref={stageRef}
          className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-primary-50 dark:bg-primary-800"
          onMouseEnter={() => activeItem?.type === 'image' && setIsZooming(true)}
          onMouseLeave={() => setIsZooming(false)}
          onMouseMove={handleMouseMove}
        >
          {activeItem?.type === 'video' && <video src={activeItem.url} controls autoPlay className="h-full w-full object-cover" />}

          {activeItem?.type === '360' && <Product360Viewer frames={activeItem.frames} alt={productName} />}

          {activeItem?.type === 'image' && (
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={handleSwipeEnd}
              onClick={() => setIsLightboxOpen(true)}
              className="h-full w-full cursor-zoom-in touch-pan-y"
            >
              <ProductPhoto src={activeItem.url} alt={activeItem.alt ?? productName} className="h-full w-full" priority />
              {isZooming && (
                <div
                  className="pointer-events-none absolute inset-0 hidden bg-no-repeat sm:block"
                  style={{
                    backgroundImage: `url(${activeItem.url})`,
                    backgroundSize: '200%',
                    backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                  }}
                />
              )}
            </motion.div>
          )}

          <button
            onClick={() => setIsLightboxOpen(true)}
            aria-label="View full-screen gallery"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-primary-900 shadow-soft hover:bg-white dark:bg-primary-900/80 dark:text-white dark:hover:bg-primary-900"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {isLightboxOpen && (
        <ProductGalleryLightbox
          items={items}
          index={activeIndex}
          onIndexChange={setActiveIndex}
          onClose={() => setIsLightboxOpen(false)}
          productName={productName}
        />
      )}
    </div>
  );
}

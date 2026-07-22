import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';

interface ProductCarouselProps {
  title: ReactNode;
  products: Product[];
  isLoading?: boolean;
  viewAllHref?: string;
  countdownTo?: string | null;
}

export function ProductCarousel({ title, products, isLoading, viewAllHref }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="container-app py-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary-900 dark:text-white">{title}</h2>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Link to={viewAllHref} className="text-sm font-medium text-accent-600 hover:underline">
              View all
            </Link>
          )}
          <button onClick={() => scroll('left')} className="hidden h-8 w-8 items-center justify-center rounded-full border border-primary-200 sm:flex dark:border-primary-600" aria-label="Scroll left">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scroll('right')} className="hidden h-8 w-8 items-center justify-center rounded-full border border-primary-200 sm:flex dark:border-primary-600" aria-label="Scroll right">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-44 shrink-0 sm:w-52">
                <ProductCardSkeleton />
              </div>
            ))
          : products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index, 6) * 0.03 }}
                className="w-44 shrink-0 sm:w-52"
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
      </div>
    </section>
  );
}

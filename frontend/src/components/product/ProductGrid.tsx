import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PackageSearch, AlertTriangle } from 'lucide-react';
import { debugLog } from '@/lib/debugLog';
import { useInventoryBatch } from '@/hooks/useInventory';

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  /** True when the underlying query failed — distinct from "loaded successfully with zero
   *  results". Without this, a fetch error looked identical to "no products found". */
  isError?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  /** True when at least one filter (color/size/price/rating/discount/brand/inStock) is active —
   *  distinguishes "your search found nothing" from "your FILTERS found nothing" (Phase 15 Section
   *  25), which get different empty-state copy and a "Clear filters" action instead of just
   *  "try a different term". */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  /** Forwarded to every ProductCard — see its own doc comment. Opt-in, unset everywhere except
   *  the homepage's premium card treatment. */
  showAddToCartButtons?: boolean;
  /** Product id -> visual-search similarity score (0-100) — forwarded to each ProductCard as its
   *  `similarityScore`. Omitted everywhere except visual search results. */
  similarityScores?: Map<string, number>;
}

export function ProductGrid({
  products,
  isLoading,
  isError,
  onRetry,
  emptyMessage,
  hasActiveFilters,
  onClearFilters,
  showAddToCartButtons,
  similarityScores,
}: ProductGridProps) {
  debugLog('ProductGrid', 'render', { isLoading, isError, count: products.length });
  // One batched inventory read for the whole grid instead of each ProductCard firing its own —
  // see useInventoryBatch's docstring.
  const { data: inventoryMap } = useInventoryBatch(products.map((p) => p.id));
  if (isLoading) return <ProductGridSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-primary-50 py-16 text-center dark:bg-primary-800">
        <AlertTriangle size={24} className="text-primary-400" />
        <p className="text-sm text-primary-500 dark:text-primary-300">Couldn't load these products.</p>
        {onRetry && (
          <button onClick={onRetry} className="text-sm font-medium text-accent-600 hover:underline">
            Retry
          </button>
        )}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <EmptyState
          icon={PackageSearch}
          title={hasActiveFilters ? 'No products match your filters' : 'No products found'}
          description={
            emptyMessage ?? (hasActiveFilters ? 'Try removing a filter to see more results.' : 'Try a different search term or browse a category instead.')
          }
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {hasActiveFilters && onClearFilters && (
            <button onClick={onClearFilters} className="btn-outline text-sm">
              Clear Filters
            </button>
          )}
          <Link to="/men" className="btn-outline text-sm">
            Browse Men
          </Link>
          <Link to="/kids" className="btn-outline text-sm">
            Browse Kids
          </Link>
          <Link to="/new-arrivals" className="btn-outline text-sm">
            New Arrivals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          inventory={inventoryMap ? (inventoryMap[product.id] ?? null) : undefined}
          skipOwnFetch
          showAddToCartButton={showAddToCartButtons}
          similarityScore={similarityScores?.get(product.id)}
        />
      ))}
    </motion.div>
  );
}

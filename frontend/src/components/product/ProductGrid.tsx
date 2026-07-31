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
}

export function ProductGrid({ products, isLoading, isError, onRetry, emptyMessage }: ProductGridProps) {
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
      <EmptyState
        icon={PackageSearch}
        title="No products found"
        description={emptyMessage ?? 'Try adjusting your filters or search terms.'}
      />
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
        <ProductCard key={product.id} product={product} inventory={inventoryMap ? (inventoryMap[product.id] ?? null) : undefined} skipOwnFetch />
      ))}
    </motion.div>
  );
}

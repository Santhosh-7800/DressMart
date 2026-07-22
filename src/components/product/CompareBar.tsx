import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Scale } from 'lucide-react';
import { useCompare, MAX_COMPARE } from '@/hooks/useCompare';
import { productService } from '@/services/productService';
import { ProductImage } from '@/components/ui/ProductImage';

export function CompareBar() {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();

  const { data: products } = useQuery({
    queryKey: ['products', 'compare-bar', compareIds],
    queryFn: () => productService.getByIds(compareIds),
    enabled: compareIds.length > 0,
  });

  if (compareIds.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary-100 bg-card shadow-popover dark:border-primary-700 dark:bg-card-dark">
      <div className="container-app flex flex-wrap items-center gap-3 py-3 pr-20 sm:pr-28">
        <div className="flex shrink-0 items-center gap-2 text-sm font-semibold">
          <Scale size={16} className="text-accent" />
          Compare ({compareIds.length}/{MAX_COMPARE})
        </div>

        <div className="scrollbar-thin flex flex-1 items-center gap-2 overflow-x-auto">
          {(products ?? []).map((product) => (
            <span key={product.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-1 pr-2 text-xs dark:bg-primary-800">
              <ProductImage src={product.imageUrl ?? product.images[0]?.url} alt="" className="h-6 w-6 rounded-full" priority />
              <span className="max-w-[100px] truncate">{product.name}</span>
              <button onClick={() => removeFromCompare(product.id)} aria-label={`Remove ${product.name} from compare`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button onClick={clearCompare} className="text-xs font-medium text-primary-400 hover:text-primary-600 dark:hover:text-primary-200">
            Clear all
          </button>
          <Link to="/compare" className="btn-accent whitespace-nowrap">
            Compare
          </Link>
        </div>
      </div>
    </div>
  );
}

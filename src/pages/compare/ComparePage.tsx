import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, ShoppingCart, Scale } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Rating } from '@/components/ui/Rating';
import { PriceTag } from '@/components/ui/PriceTag';
import { Button } from '@/components/ui/Button';
import { ProductImage } from '@/components/ui/ProductImage';
import { useCompare } from '@/hooks/useCompare';
import { useCart } from '@/hooks/useCart';
import { useRatingSummary } from '@/hooks/useProducts';
import { productService } from '@/services/productService';
import type { Product } from '@/types';

function CompareRating({ product }: { product: Product }) {
  const { data: ratingSummary } = useRatingSummary(product.id);
  return <Rating value={ratingSummary?.average_rating ?? 0} count={ratingSummary?.total_reviews ?? 0} showValue />;
}

const SPEC_ROWS: { label: string; key: keyof Product['specifications'] }[] = [
  { label: 'Material', key: 'material' },
  { label: 'Fit', key: 'fit' },
  { label: 'Pattern', key: 'pattern' },
  { label: 'Occasion', key: 'occasion' },
  { label: 'Country of Origin', key: 'country_of_origin' },
];

interface CompareRowProps {
  label: string;
  products: Product[];
  render: (product: Product) => ReactNode;
}

function CompareRow({ label, products, render }: CompareRowProps) {
  return (
    <tr>
      <td className="sticky left-0 z-10 whitespace-nowrap border-t border-primary-100 bg-card p-4 text-xs font-semibold uppercase tracking-wide text-primary-400 dark:border-primary-700 dark:bg-card-dark">
        {label}
      </td>
      {products.map((product) => (
        <td key={product.id} className="border-l border-t border-primary-100 p-4 align-top dark:border-primary-700">
          {render(product)}
        </td>
      ))}
    </tr>
  );
}

export function ComparePage() {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const { addItem } = useCart();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', 'compare', compareIds],
    queryFn: () => productService.getByIds(compareIds),
    enabled: compareIds.length > 0,
  });

  const list = products ?? [];

  return (
    <div className="container-app py-6">
      <Seo title="Compare Products" description="Compare up to 4 products side by side on price, ratings, and specifications." />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={22} className="text-accent" />
          <h1 className="text-2xl font-bold">Compare Products</h1>
        </div>
        {list.length > 0 && (
          <button onClick={clearCompare} className="text-sm font-medium text-primary-400 hover:text-primary-600 dark:hover:text-primary-200">
            Clear all
          </button>
        )}
      </div>

      {isLoading && <Skeleton className="h-96 w-full" />}

      {!isLoading && list.length === 0 && (
        <EmptyState
          icon={Scale}
          title="No products to compare"
          description="Add up to 4 products from any listing page using the Compare checkbox on a product card."
          actionLabel="Start Shopping"
          actionHref="/"
        />
      )}

      {!isLoading && list.length > 0 && (
        <div className="scrollbar-thin overflow-x-auto rounded-2xl bg-card shadow-soft dark:bg-card-dark">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-36 bg-card p-4 align-bottom dark:bg-card-dark sm:w-44" />
                {list.map((product) => (
                  <th key={product.id} className="w-[220px] border-l border-primary-100 p-4 text-left align-top font-normal dark:border-primary-700">
                    <button
                      onClick={() => removeFromCompare(product.id)}
                      aria-label={`Remove ${product.name} from compare`}
                      className="mb-2 ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-500 hover:bg-primary-200 dark:bg-primary-700 dark:text-primary-300 dark:hover:bg-primary-600"
                    >
                      <X size={13} />
                    </button>
                    <Link to={`/product/${product.slug}`} className="block">
                      <ProductImage
                        src={product.imageUrl ?? product.images[0]?.url}
                        alt={product.name}
                        className="aspect-[4/5] w-full rounded-xl bg-primary-50 dark:bg-primary-800"
                        priority
                      />
                      <p className="mt-2 line-clamp-2 text-sm font-medium text-primary-900 dark:text-white">{product.name}</p>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Brand" products={list} render={(p) => p.brand?.name ?? '—'} />
              <CompareRow label="Price" products={list} render={(p) => <PriceTag price={p.price} mrp={p.mrp} discountPercent={p.discount_percent} size="sm" />} />
              <CompareRow label="Rating" products={list} render={(p) => <CompareRating product={p} />} />
              {SPEC_ROWS.map((row) => (
                <CompareRow key={row.key} label={row.label} products={list} render={(p) => p.specifications[row.key] ?? '—'} />
              ))}
              <CompareRow
                label="Availability"
                products={list}
                render={(p) => (p.total_stock > 0 ? <span className="font-medium text-emerald-600">In Stock</span> : <span className="font-medium text-red-500">Out of Stock</span>)}
              />
              <tr>
                <td className="sticky left-0 z-10 border-t border-primary-100 bg-card p-4 dark:border-primary-700 dark:bg-card-dark" />
                {list.map((product) => (
                  <td key={product.id} className="border-l border-t border-primary-100 p-4 dark:border-primary-700">
                    <Button
                      variant="accent"
                      fullWidth
                      disabled={product.total_stock <= 0}
                      onClick={() => {
                        const variant = product.variants[0];
                        if (variant) addItem({ productId: product.id, variantId: variant.id });
                      }}
                    >
                      <ShoppingCart size={14} className="mr-1.5" /> Add to Cart
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useCompleteTheLook } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { inventoryService } from '@/services/inventoryService';

interface CompleteTheLookProps {
  product: Product;
}

export function CompleteTheLook({ product }: CompleteTheLookProps) {
  const { data: items, isLoading } = useCompleteTheLook(product);
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  if (!isLoading && (!items || items.length === 0)) return null;

  const handleAddEntireOutfit = async () => {
    if (!items || items.length === 0) return;
    setIsAdding(true);
    try {
      // Stock lives in a separate inventory doc per product (see types/database.ts) — checked here,
      // at add-to-cart time, rather than while just rendering the outfit strip.
      const inventories = await Promise.all(items.map((item) => inventoryService.getInventory(item.product.id)));
      const inStockItems = items.filter((_, idx) => (inventories[idx]?.total_stock ?? 0) > 0);
      if (inStockItems.length === 0) {
        toast.error('These items are currently out of stock');
        return;
      }
      await Promise.all(
        inStockItems.map((item) => {
          const inventory = inventories[items.indexOf(item)];
          const variant = item.product.variants.find((v) => (inventory?.variant_stock[v.id] ?? 0) > 0) ?? item.product.variants[0];
          return addItem({ productId: item.product.id, variantId: variant.id });
        }),
      );
      toast.success('Added the complete outfit to your cart');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <section className="mt-10 border-t border-primary-100 pt-8 dark:border-primary-700">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary-900 dark:text-white">Complete the Look</h2>
          <p className="text-sm text-primary-400">Hand-picked pieces that pair well with this item</p>
        </div>
        {!isLoading && items && items.length > 0 && (
          <Button variant="accent" size="sm" onClick={handleAddEntireOutfit} isLoading={isAdding}>
            <ShoppingBag size={15} /> Add Entire Outfit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : items!.map((item) => <ProductCard key={item.product.id} product={item.product} />)}
      </div>
    </section>
  );
}

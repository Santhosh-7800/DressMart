import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { inventoryService } from '@/services/inventoryService';
import { queryKeys } from '@/lib/queryClient';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import type { Inventory } from '@/types';

/** One-shot, cached read — for grids/tables where a live listener per row would be overkill.
 *  `enabled` lets a batched parent (see useInventoryBatch below) suppress this card's own
 *  individual fetch once it's already supplying the same data from one batched query. */
export function useInventory(productId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.inventory.detail(productId ?? ''),
    queryFn: () => inventoryService.getInventory(productId as string),
    enabled: Boolean(productId) && enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * Batched read for a whole grid/carousel of products — one Firestore batch-get instead of one
 * independent read per rendered ProductCard (which is what happens if every card just calls
 * useInventory() on its own for N products on the same page). Pass the resulting map's entries
 * down to ProductCard's `inventory`/`skipOwnFetch` props.
 */
export function useInventoryBatch(productIds: string[]) {
  return useQuery({
    queryKey: ['inventory', 'batch', productIds],
    queryFn: () => inventoryService.getInventoryBatch(productIds),
    enabled: productIds.length > 0,
    staleTime: 30 * 1000,
  });
}

/**
 * Realtime subscription — for the PDP, where a shopper deciding to buy should see stock drop (or
 * come back) immediately if someone else checks out first, per spec. Also keeps the shared
 * react-query cache for this product's inventory in sync, so any useInventory() reader elsewhere
 * on the page benefits from the same live data.
 */
export function useInventoryRealtime(productId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [inventory, setInventory] = useState<Inventory | null | undefined>(undefined);

  useEffect(() => {
    if (!productId) {
      setInventory(undefined);
      return;
    }
    setInventory(undefined);
    const unsubscribe = inventoryService.subscribeToInventory(productId, (inv) => {
      setInventory(inv);
      queryClient.setQueryData(queryKeys.inventory.detail(productId), inv);
    });
    return unsubscribe;
  }, [productId, queryClient]);

  return { data: inventory, isLoading: inventory === undefined };
}

/** Seller's Inventory management page — updates variant_stock/total_stock/low_stock_threshold. */
export function useUpdateStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, variantStock, lowStockThreshold }: { productId: string; variantStock: Record<string, number>; lowStockThreshold: number }) =>
      inventoryService.updateStock(productId, variantStock, lowStockThreshold),
    onSuccess: (_data, { productId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.detail(productId) });
      // Seller pages (SellerProductsPage/SellerInventoryPage) batch-fetch inventory under this
      // key prefix keyed by a freshly-computed product-id array each render, so an exact key match
      // never hits — invalidate the whole prefix instead.
      queryClient.invalidateQueries({ queryKey: ['seller', 'inventory', 'batch'] });
      toast.success('Stock updated');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

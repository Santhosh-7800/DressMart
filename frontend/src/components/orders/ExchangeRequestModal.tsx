import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EXCHANGE_REASONS } from '@/lib/exchangeStatus';
import { useRequestExchange } from '@/hooks/useExchanges';
import { useInventory } from '@/hooks/useInventory';
import { cn } from '@/lib/utils';
import type { Order, OrderItem, Product } from '@/types';

interface ExchangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  item: OrderItem;
}

async function fetchProduct(productId: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, 'products', productId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Product) : null;
}

export function ExchangeRequestModal({ isOpen, onClose, order, item }: ExchangeRequestModalProps) {
  const requestExchange = useRequestExchange();
  const [reason, setReason] = useState(EXCHANGE_REASONS[0]);
  const [comment, setComment] = useState('');
  const [desiredColor, setDesiredColor] = useState(item.color);
  const [desiredSize, setDesiredSize] = useState(item.size);

  const productQuery = useQuery({
    queryKey: ['products', 'detail-raw', item.product_id],
    queryFn: () => fetchProduct(item.product_id),
    enabled: isOpen,
  });
  const product = productQuery.data;
  // A desired variant that exists in the catalog but has zero stock right now would otherwise only
  // surface as a problem later, when the seller tries to approve/complete the exchange — checking
  // here lets the customer pick something actually available up front.
  const { data: inventory } = useInventory(item.product_id, isOpen);

  const colors = useMemo(() => {
    if (!product) return [];
    const seen = new Map<string, string>();
    product.variants.forEach((v) => seen.set(v.color, v.color_hex));
    return Array.from(seen.entries()).map(([name, hex]) => ({ name, hex }));
  }, [product]);

  const sizesForColor = useMemo(() => {
    if (!product) return [];
    return product.variants
      .filter((v) => v.color === desiredColor)
      .map((v) => ({ size: v.size, inStock: !inventory || (inventory.variant_stock[v.id] ?? 0) > 0 }));
  }, [product, desiredColor, inventory]);

  const desiredVariant = useMemo(
    () => product?.variants.find((v) => v.color === desiredColor && v.size === desiredSize),
    [product, desiredColor, desiredSize],
  );
  const desiredVariantStock = desiredVariant ? (inventory?.variant_stock[desiredVariant.id] ?? 0) : 0;
  // Same "assume in stock while inventory is still loading" tradeoff used on the PDP's size
  // selector — avoids blocking submission on a slow inventory read for the overwhelmingly common
  // case where the desired variant IS available.
  const desiredVariantAvailable = !desiredVariant || !inventory || desiredVariantStock > 0;

  const handleSubmit = async () => {
    if (!desiredVariant || !desiredVariantAvailable) return;
    await requestExchange.mutateAsync({
      order,
      orderItemId: item.id,
      reason,
      comment,
      desiredVariantId: desiredVariant.id,
      desiredSize: desiredVariant.size,
      desiredColor: desiredVariant.color,
    });
    setComment('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request an Exchange">
      <div className="space-y-3">
        <p className="text-sm text-primary-500">{item.product_name}</p>
        <p className="text-xs text-primary-400">
          Current: Size {item.size} · Color {item.color}
        </p>

        {productQuery.isLoading ? (
          <p className="text-sm text-primary-400">Loading available sizes/colors…</p>
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-sm font-medium">Desired color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setDesiredColor(c.name)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                      desiredColor === c.name ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600',
                    )}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border border-primary-200" style={{ backgroundColor: c.hex }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Desired size</p>
              <div className="flex flex-wrap gap-2">
                {sizesForColor.map(({ size, inStock }) => (
                  <button
                    key={size}
                    onClick={() => setDesiredSize(size)}
                    disabled={!inStock}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through',
                      desiredSize === size ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600',
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            {desiredVariant && !desiredVariantAvailable && (
              <p className="text-xs font-medium text-red-500">This size/color is currently out of stock — pick another to continue.</p>
            )}
          </>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium">Reason for exchange</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field">
            {EXCHANGE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Additional comments (optional)</p>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="input-field" rows={3} />
        </div>
        <Button variant="accent" fullWidth onClick={handleSubmit} isLoading={requestExchange.isPending} disabled={!desiredVariant || !desiredVariantAvailable}>
          Submit Exchange Request
        </Button>
      </div>
    </Modal>
  );
}

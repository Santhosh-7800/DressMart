import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAdjustStock } from '@/hooks/useInventory';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import toast from 'react-hot-toast';
import type { Product, ProductVariant } from '@/types';

const REASONS = ['New stock received', 'Damaged item', 'Missing item', 'Physical stock correction', 'Returned stock', 'Exchange adjustment', 'Other'];

export interface StockAdjustTarget {
  product: Product;
  variant: ProductVariant;
  currentStock: number;
}

/**
 * Single-SKU +/- adjustment with a mandatory reason — Phase 12's "Stock Adjustment" workflow.
 * Deliberately separate from the bulk VariantStockEditor above it on the same page: this one goes
 * through the adjustStock Cloud Function (audited, reason-required, rejects negative results),
 * rather than the bulk editor's "type the new absolute number, save everything at once" pattern.
 */
export function StockAdjustModal({ target, sellerId, onClose }: { target: StockAdjustTarget | null; sellerId: string; onClose: () => void }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const adjustStock = useAdjustStock();
  const isOnline = useOnlineStatus();

  const resultingStock = target ? target.currentStock + delta : 0;
  const isInvalid = resultingStock < 0;

  const reset = () => {
    setDelta(0);
    setReason(REASONS[0]);
    setOtherReason('');
  };

  const handleConfirm = () => {
    if (!target || delta === 0 || isInvalid) return;
    if (!isOnline) {
      toast.error("You're offline. Reconnect and try updating stock again.");
      return;
    }
    const finalReason = reason === 'Other' ? otherReason.trim() : reason;
    if (!finalReason) {
      toast.error('Please describe the reason.');
      return;
    }
    adjustStock.mutate(
      { productId: target.product.id, variantId: target.variant.id, delta, reason: finalReason, sellerId, productName: target.product.name },
      { onSuccess: () => { onClose(); reset(); } },
    );
  };

  return (
    <Modal isOpen={Boolean(target)} onClose={() => { onClose(); reset(); }} title="Adjust Stock">
      {target && (
        <div className="space-y-4">
          <div className="rounded-xl bg-primary-50 p-3 text-sm dark:bg-primary-800/50">
            <p className="font-medium">{target.product.name}</p>
            <p className="text-xs text-primary-400">
              {target.variant.color} · {target.variant.size} · SKU: {target.variant.sku}
            </p>
            <p className="mt-1 text-xs text-primary-400">Current stock: {target.currentStock}</p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setDelta((d) => d - 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-primary-200 text-primary-600 dark:border-primary-600"
              aria-label="Decrease"
            >
              <Minus size={18} />
            </button>
            <div className="text-center">
              <input
                type="number"
                inputMode="numeric"
                value={delta}
                onChange={(e) => setDelta(Math.round(Number(e.target.value) || 0))}
                className="w-20 rounded-lg border border-primary-200 px-2 py-2 text-center text-xl font-bold dark:border-primary-600 dark:bg-primary-800"
              />
              <p className="mt-1 text-xs text-primary-400">{delta > 0 ? 'Increase' : delta < 0 ? 'Decrease' : 'No change'}</p>
            </div>
            <button
              type="button"
              onClick={() => setDelta((d) => d + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-primary-200 text-primary-600 dark:border-primary-600"
              aria-label="Increase"
            >
              <Plus size={18} />
            </button>
          </div>

          <p className={`text-center text-sm font-semibold ${isInvalid ? 'text-red-600' : 'text-primary-700 dark:text-primary-200'}`}>
            Result: {resultingStock}
            {isInvalid && ' — cannot go below zero'}
          </p>

          <div>
            <p className="mb-2 text-sm font-medium">Reason</p>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field w-full">
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {reason === 'Other' && (
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value.slice(0, 200))}
                placeholder="Describe the reason"
                rows={2}
                className="input-field mt-2 w-full resize-none"
              />
            )}
          </div>

          <Button variant="accent" fullWidth onClick={handleConfirm} isLoading={adjustStock.isPending} disabled={delta === 0 || isInvalid}>
            Confirm Adjustment
          </Button>
        </div>
      )}
    </Modal>
  );
}

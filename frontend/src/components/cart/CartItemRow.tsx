import { Link } from 'react-router-dom';
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion';
import { Trash2, Heart, PackageX } from 'lucide-react';
import type { CartLineItem } from '@/services/cartService';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { ProductImage } from '@/components/ui/ProductImage';
import { formatCurrency } from '@/lib/utils';

interface CartItemRowProps {
  item: CartLineItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  onSaveForLater?: () => void;
  onMoveToCart?: () => void;
}

// Reveal width for the swipe-to-delete backdrop and the drag distance past which releasing
// deletes the item outright — set relative to each other so "let go anywhere past halfway
// revealed" removes it, matching the native swipe-to-delete feel (Gmail, most Android list UIs).
const SWIPE_REVEAL_PX = 88;
const SWIPE_DELETE_THRESHOLD = -SWIPE_REVEAL_PX * 0.6;

export function CartItemRow({ item, onUpdateQuantity, onRemove, onSaveForLater, onMoveToCart }: CartItemRowProps) {
  const product = item.product;
  const variant = item.variant;
  const price = variant?.price_override ?? product?.price ?? 0;
  const outOfStock = item.availableStock <= 0;
  const x = useMotionValue(0);

  const handleDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (info.offset.x < SWIPE_DELETE_THRESHOLD) {
      onRemove();
    } else {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
    }
  };

  // A cart line's product can go missing after it was added (deleted, or — in dev/staging — the
  // catalog got reseeded with new document ids). Previously this returned null: the line vanished
  // from the list entirely while still counted in the cart's totals/item-count, which looked
  // exactly like "I added it but the cart page doesn't show it." Rendering a clear, removable
  // placeholder instead means the item is never silently invisible — the shopper can always see
  // what's in their cart and remove anything that's no longer valid.
  if (!product) {
    return (
      <div className="flex items-center gap-4 border-b border-primary-100 py-5 last:border-0 dark:border-primary-700">
        <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-800">
          <PackageX size={28} className="text-primary-300" />
        </div>
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-primary-400">This product is no longer available</p>
            <p className="mt-1 text-xs text-primary-400">
              Size: {item.size} · Color: {item.color}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-primary-400">Qty: {item.quantity}</p>
            <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
          </div>
          <div className="flex gap-4 text-xs">
            <button onClick={onRemove} className="flex items-center gap-1 text-primary-400 hover:text-red-500">
              <Trash2 size={13} /> Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, x: -40 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative overflow-hidden border-b border-primary-100 last:border-0 dark:border-primary-700"
    >
      {/* Delete backdrop, revealed as the row above is dragged left. */}
      <div className="absolute inset-0 flex items-center justify-end bg-red-500 pr-7">
        <Trash2 size={20} className="text-white" />
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -SWIPE_REVEAL_PX, right: 0 }}
        dragElastic={0.08}
        style={{ x }}
        onDragEnd={handleDragEnd}
        // relative — without an explicit position, this in-flow sibling paints BEHIND the
        // absolutely-positioned backdrop above regardless of DOM order (CSS stacking rules put
        // positioned elements above non-positioned ones), which would silently block every
        // pointer interaction with the row — drag, links, buttons — not just hide the backdrop
        // visually as intended.
        className="relative flex gap-4 bg-surface py-5 dark:bg-surface-dark"
      >
        <Link to={`/product/${product.slug}`} className="shrink-0">
          <ProductImage
            src={product.images.find((i) => i.color === variant?.color)?.url ?? product.imageUrl ?? product.images[0]?.url}
            alt={product.name}
            className="h-28 w-24 rounded-lg"
          />
        </Link>
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <Link to={`/product/${product.slug}`} className="text-sm font-medium hover:text-accent-600 line-clamp-2">
              {product.name}
            </Link>
            <p className="mt-1 text-xs text-primary-400">
              Size: {variant?.size} · Color: {variant?.color}
            </p>
            {outOfStock && <p className="mt-1 text-xs font-semibold text-red-500">Out of stock</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <QuantitySelector value={item.quantity} onChange={onUpdateQuantity} max={Math.max(item.availableStock, 1)} />
            <p className="font-semibold">{formatCurrency(price * item.quantity)}</p>
          </div>
          <div className="flex gap-4 text-xs">
            <button onClick={onRemove} className="flex items-center gap-1 text-primary-400 hover:text-red-500">
              <Trash2 size={13} /> Remove
            </button>
            {onSaveForLater && (
              <button onClick={onSaveForLater} className="flex items-center gap-1 text-primary-400 hover:text-accent-600">
                <Heart size={13} /> Save for later
              </button>
            )}
            {onMoveToCart && (
              <button onClick={onMoveToCart} className="font-medium text-accent-600 hover:underline">
                Move to cart
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

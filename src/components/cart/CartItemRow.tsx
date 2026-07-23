import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2, Heart } from 'lucide-react';
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

export function CartItemRow({ item, onUpdateQuantity, onRemove, onSaveForLater, onMoveToCart }: CartItemRowProps) {
  const product = item.product;
  const variant = item.variant;
  const price = variant?.price_override ?? product?.price ?? 0;
  const outOfStock = item.availableStock <= 0;

  if (!product) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, x: -40 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex gap-4 overflow-hidden border-b border-primary-100 py-5 last:border-0 dark:border-primary-700"
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
  );
}

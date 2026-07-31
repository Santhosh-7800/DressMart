import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCart } from './useCart';
import { getBuyNowItem } from '@/lib/buyNowSession';
import type { CartLineItem } from '@/services/cartService';
import type { Inventory, Product } from '@/types';

async function loadBuyNowLineItem(): Promise<CartLineItem | null> {
  const buyNow = getBuyNowItem();
  if (!buyNow) return null;

  const [productSnap, inventorySnap] = await Promise.all([
    getDoc(doc(db, 'products', buyNow.productId)),
    getDoc(doc(db, 'inventory', buyNow.productId)),
  ]);
  if (!productSnap.exists()) return null;
  const product = { id: productSnap.id, ...productSnap.data() } as Product;
  const variant = product.variants.find((v) => v.id === buyNow.variantId);
  const inventory = inventorySnap.exists() ? (inventorySnap.data() as Inventory) : null;
  const availableStock = inventory?.variant_stock?.[buyNow.variantId] ?? 0;

  return {
    id: 'buy-now',
    productId: buyNow.productId,
    variantId: buyNow.variantId,
    sellerId: product.seller_id,
    size: variant?.size ?? '',
    color: variant?.color ?? '',
    quantity: buyNow.quantity,
    price: variant?.price_override ?? product.price,
    image: product.images.find((img) => img.color === variant?.color)?.url ?? product.coverImage ?? '',
    addedAt: new Date().toISOString(),
    savedForLater: false,
    product,
    variant,
    availableStock,
  };
}

/**
 * What Checkout/Payment actually check out — either the buyer's real persistent cart, or (when a
 * Buy Now session is active, see lib/buyNowSession.ts) exactly one item that was never added to
 * the cart at all. Same shape either way, so CheckoutPage/PaymentPage don't need to branch.
 */
export function useCheckoutItems() {
  const cart = useCart();
  const buyNowRef = getBuyNowItem();

  const buyNowQuery = useQuery({
    queryKey: ['buy-now-item', buyNowRef?.productId, buyNowRef?.variantId, buyNowRef?.quantity],
    queryFn: loadBuyNowLineItem,
    enabled: Boolean(buyNowRef),
  });

  if (buyNowRef) {
    const item = buyNowQuery.data;
    const items = item ? [item] : [];
    const subtotal = item ? (item.variant?.price_override ?? item.product?.price ?? item.price) * item.quantity : 0;
    const totalMrp = item ? (item.product?.mrp ?? item.price) * item.quantity : 0;
    return {
      items,
      subtotal,
      totalMrp,
      totalDiscount: Math.max(totalMrp - subtotal, 0),
      totalItems: item?.quantity ?? 0,
      hasOutOfStockItems: item ? item.quantity > item.availableStock : false,
      isLoading: buyNowQuery.isLoading,
      isBuyNow: true as const,
    };
  }

  return { ...cart, isBuyNow: false as const };
}

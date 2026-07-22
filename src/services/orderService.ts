import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Address, CartItem, Coupon, Order, OrderStatus, OrderTimelineEvent, PaymentMethod } from '@/types';
import { getOrders, saveOrders } from './mock/mockUserData';
import { generateOrderNumber } from '@/lib/utils';
import { rewardsService } from './rewardsService';
import { referralService } from './referralService';
import { generateCourierInfo } from '@/lib/courier';

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Order Placed',
  confirmed: 'Order Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

const HAPPY_PATH: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

function buildTimeline(placedAt: string, currentStatus: OrderStatus): OrderTimelineEvent[] {
  if (currentStatus === 'cancelled') {
    return [
      { status: 'placed', label: STATUS_LABELS.placed, timestamp: placedAt },
      { status: 'cancelled', label: STATUS_LABELS.cancelled, timestamp: new Date().toISOString(), note: 'Cancelled by customer' },
    ];
  }

  const currentIdx = HAPPY_PATH.indexOf(currentStatus === 'returned' ? 'delivered' : currentStatus);
  const events: OrderTimelineEvent[] = HAPPY_PATH.slice(0, currentIdx + 1).map((status, idx) => ({
    status,
    label: STATUS_LABELS[status],
    timestamp: new Date(new Date(placedAt).getTime() + idx * 20 * 60 * 60 * 1000).toISOString(),
  }));

  if (currentStatus === 'returned') {
    events.push({ status: 'returned', label: STATUS_LABELS.returned, timestamp: new Date().toISOString() });
  }

  return events;
}

export interface PlaceOrderInput {
  userId: string;
  cartItems: CartItem[];
  address: Address;
  paymentMethod: PaymentMethod;
  coupon: Coupon | null;
  shippingFee: number;
  taxRate: number;
  /** Rupee value of reward points redeemed on this order, on top of any coupon discount. */
  pointsDiscount?: number;
}

function computeTotals(cartItems: CartItem[], coupon: Coupon | null, shippingFee: number, taxRate: number, pointsDiscount = 0) {
  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.variant?.price_override ?? item.product?.price ?? 0;
    return sum + price * item.quantity;
  }, 0);

  let discount = 0;
  if (coupon && subtotal >= coupon.min_order_value) {
    discount = coupon.discount_type === 'percent' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
    if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
  }
  discount += Math.max(pointsDiscount, 0);

  const taxableAmount = Math.max(subtotal - discount, 0);
  const tax = Math.round(taxableAmount * taxRate);
  const total = Math.round(taxableAmount + tax + shippingFee);

  return { subtotal: Math.round(subtotal), discount: Math.round(discount), tax, total };
}

export const orderService = {
  async list(userId: string): Promise<Order[]> {
    if (env.useMockData) return [...getOrders(userId)].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
    const { data, error } = await supabase.from('orders').select('*, items:order_items(*), address:addresses(*)').eq('user_id', userId).order('placed_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as unknown as Order[];
  },

  async getById(userId: string, orderId: string): Promise<Order | null> {
    if (env.useMockData) return getOrders(userId).find((o) => o.id === orderId) ?? null;
    const { data, error } = await supabase.from('orders').select('*, items:order_items(*), address:addresses(*)').eq('id', orderId).single();
    if (error) return null;
    return data as unknown as Order;
  },

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    const totals = computeTotals(input.cartItems, input.coupon, input.shippingFee, input.taxRate, input.pointsDiscount);
    const placedAt = new Date().toISOString();
    const estimatedDelivery = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const courier = generateCourierInfo();

    const order: Order = {
      id: `order-${Date.now()}`,
      order_number: generateOrderNumber(),
      user_id: input.userId,
      status: 'placed',
      items: input.cartItems.map((item) => ({
        id: `oi-${Date.now()}-${item.id}`,
        order_id: '',
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product?.name ?? '',
        product_image: item.product?.images[0]?.url ?? '',
        product_slug: item.product?.slug ?? '',
        brand_name: item.product?.brand?.name ?? '',
        size: item.variant?.size ?? '',
        color: item.variant?.color ?? '',
        quantity: item.quantity,
        unit_price: item.variant?.price_override ?? item.product?.price ?? 0,
        total_price: (item.variant?.price_override ?? item.product?.price ?? 0) * item.quantity,
        return_status: 'none',
      })),
      address: input.address,
      subtotal: totals.subtotal,
      discount: totals.discount,
      shipping_fee: input.shippingFee,
      tax: totals.tax,
      total: totals.total,
      coupon_code: input.coupon?.code ?? null,
      payment_method: input.paymentMethod,
      payment_status: input.paymentMethod === 'cod' ? 'pending' : 'paid',
      timeline: buildTimeline(placedAt, 'placed'),
      estimated_delivery: estimatedDelivery,
      placed_at: placedAt,
      tracking_number: courier.trackingNumber,
      courier_name: courier.courierName,
      courier_phone: courier.courierPhone,
    };
    order.items = order.items.map((i) => ({ ...i, order_id: order.id }));

    if (env.useMockData) {
      const orders = getOrders(input.userId);
      orders.push(order);
      saveOrders(input.userId, orders);
      await rewardsService.earnPointsForOrder(input.userId, order.total, order.id);
      await referralService.completeReferralIfPending(input.userId);
      return order;
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: order.user_id,
        order_number: order.order_number,
        status: order.status,
        address_id: input.address.id,
        subtotal: order.subtotal,
        discount: order.discount,
        shipping_fee: order.shipping_fee,
        tax: order.tax,
        total: order.total,
        coupon_code: order.coupon_code,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        estimated_delivery: order.estimated_delivery,
        tracking_number: order.tracking_number,
        courier_name: order.courier_name,
        courier_phone: order.courier_phone,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const orderItemsPayload = order.items.map((i) => ({ ...i, order_id: data.id, id: undefined }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload);
    if (itemsError) throw new Error(itemsError.message);

    await rewardsService.earnPointsForOrder(input.userId, order.total, data.id);
    await referralService.completeReferralIfPending(input.userId);

    return this.getById(input.userId, data.id) as Promise<Order>;
  },

  async cancel(userId: string, orderId: string, reason: string): Promise<Order> {
    if (env.useMockData) {
      const orders = getOrders(userId);
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error('Order not found.');
      orders[idx] = {
        ...orders[idx],
        status: 'cancelled',
        timeline: [...orders[idx].timeline, { status: 'cancelled', label: STATUS_LABELS.cancelled, timestamp: new Date().toISOString(), note: reason }],
      };
      saveOrders(userId, orders);
      return orders[idx];
    }
    const { data, error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId).select().single();
    if (error) throw new Error(error.message);
    return data as unknown as Order;
  },

  /** Admin/staff fulfillment action — set an order to an explicit status (Accept/Pack/Ship/Deliver/Cancel), not just "advance one step". */
  async setStatus(userId: string, orderId: string, status: OrderStatus): Promise<Order> {
    if (env.useMockData) {
      const orders = getOrders(userId);
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) throw new Error('Order not found.');
      orders[idx] = { ...orders[idx], status, timeline: buildTimeline(orders[idx].placed_at, status) };
      saveOrders(userId, orders);
      return orders[idx];
    }
    const { data, error } = await supabase.from('orders').update({ status }).eq('id', orderId).select().single();
    if (error) throw new Error(error.message);
    return data as unknown as Order;
  },

  /** Advances a mock order through its happy-path timeline — used to demo order tracking without a real fulfillment backend. */
  async simulateProgress(userId: string, orderId: string): Promise<Order> {
    const orders = getOrders(userId);
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error('Order not found.');
    const currentIdx = HAPPY_PATH.indexOf(orders[idx].status);
    const nextStatus = HAPPY_PATH[Math.min(currentIdx + 1, HAPPY_PATH.length - 1)];
    orders[idx] = { ...orders[idx], status: nextStatus, timeline: buildTimeline(orders[idx].placed_at, nextStatus) };
    saveOrders(userId, orders);
    return orders[idx];
  },
};

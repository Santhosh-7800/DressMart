// Supabase Edge Function: place-order
// Validates cart stock and creates an order + order items atomically, server-side.
// Deploy with: supabase functions deploy place-order
// Invoke from the client with: supabase.functions.invoke('place-order', { body: {...} })

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface PlaceOrderPayload {
  addressId: string;
  paymentMethod: 'upi' | 'credit_card' | 'debit_card' | 'net_banking' | 'wallet' | 'cod';
  couponCode?: string;
  shippingFee: number;
  taxRate: number;
}

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }

    const payload: PlaceOrderPayload = await req.json();

    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select('*, product:products(id, name, price), variant:product_variants(id, stock, size, color, price_override)')
      .eq('user_id', user.id)
      .eq('saved_for_later', false);

    if (cartError) throw cartError;
    if (!cartItems || cartItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty' }), { status: 400 });
    }

    for (const item of cartItems) {
      if (!item.variant || item.variant.stock < item.quantity) {
        return new Response(
          JSON.stringify({ error: `${item.product?.name ?? 'An item'} in your cart is out of stock.` }),
          { status: 409 },
        );
      }
    }

    let discount = 0;
    let couponCode: string | null = null;
    const subtotal = cartItems.reduce(
      (sum: number, item: { variant?: { price_override?: number | null }; product?: { price?: number }; quantity: number }) =>
        sum + (item.variant?.price_override ?? item.product?.price ?? 0) * item.quantity,
      0,
    );

    if (payload.couponCode) {
      const { data: coupon } = await supabase.from('coupons').select('*').eq('code', payload.couponCode).eq('is_active', true).single();
      if (coupon && subtotal >= coupon.min_order_value) {
        discount = coupon.discount_type === 'percent' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
        if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
        couponCode = coupon.code;
      }
    }

    const tax = Math.round((subtotal - discount) * payload.taxRate);
    const total = Math.round(subtotal - discount + tax + payload.shippingFee);
    const orderNumber = `DM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        order_number: orderNumber,
        address_id: payload.addressId,
        subtotal,
        discount,
        shipping_fee: payload.shippingFee,
        tax,
        total,
        coupon_code: couponCode,
        payment_method: payload.paymentMethod,
        payment_status: payload.paymentMethod === 'cod' ? 'pending' : 'paid',
        estimated_delivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = cartItems.map((item: { product_id: string; variant_id: string; product?: { name?: string }; variant?: { size?: string; color?: string; price_override?: number | null }; product: { price?: number }; quantity: number }) => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.product?.name ?? '',
      product_image: '',
      size: item.variant?.size ?? '',
      color: item.variant?.color ?? '',
      quantity: item.quantity,
      unit_price: item.variant?.price_override ?? item.product?.price ?? 0,
      total_price: (item.variant?.price_override ?? item.product?.price ?? 0) * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;

    for (const item of cartItems) {
      await supabase.rpc('decrement_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity });
    }

    await supabase.from('cart_items').delete().eq('user_id', user.id).eq('saved_for_later', false);

    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Order placed successfully',
      message: `Your order ${orderNumber} has been placed and is being processed.`,
      type: 'order',
      link: `/orders/${order.id}`,
    });

    return new Response(JSON.stringify({ order }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500 });
  }
});

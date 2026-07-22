import type { Order } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';

/** Generates and downloads a plain-text tax invoice for an order — shared by Order Details and My Orders. */
export function downloadInvoice(order: Order): void {
  const lines = [
    `DressMart — Tax Invoice`,
    `Order Number: ${order.order_number}`,
    `Placed on: ${formatDateTime(order.placed_at)}`,
    `Payment Method: ${order.payment_method.toUpperCase()}`,
    ``,
    `Items:`,
    ...order.items.map((i) => `  ${i.product_name} | Brand: ${i.brand_name || '—'} | Size: ${i.size} | Color: ${i.color} | Qty: ${i.quantity} | ${formatCurrency(i.total_price)}`),
    ``,
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Discount: -${formatCurrency(order.discount)}`,
    `Shipping: ${formatCurrency(order.shipping_fee)}`,
    `Tax: ${formatCurrency(order.tax)}`,
    `Total: ${formatCurrency(order.total)}`,
    ``,
    `Delivery Address:`,
    `  ${order.address.full_name}, ${order.address.line1}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${order.order_number}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

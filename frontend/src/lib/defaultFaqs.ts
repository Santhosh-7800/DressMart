import type { SupportCategory } from '@/types';

export interface DefaultFaqEntry {
  question: string;
  answer: string;
  category: SupportCategory;
}

/**
 * Shown on the Help Center only when the `faqs` Firestore collection is completely empty (a fresh
 * install before the Head Seller has authored any content via Seller > FAQ Management) — so the
 * page is never blank out of the box. Every answer here describes real, already-implemented
 * behavior (verified against cancelOrder.ts's CANCELLABLE_STATUSES, the return/exchange
 * delivered-order precondition, Coupon's real fields, platform_settings' default return window,
 * etc.) — none of this is placeholder copy.
 */
export const DEFAULT_FAQS: DefaultFaqEntry[] = [
  {
    category: 'order',
    question: 'How do I place an order?',
    answer: 'Add items to your cart, choose a delivery address at checkout, pick a payment method (UPI/Card/Net Banking/Wallet via Razorpay, or Cash on Delivery where available), and confirm. You\'ll get an order confirmation immediately.',
  },
  {
    category: 'order',
    question: 'How can I cancel my order?',
    answer: 'Open the order from My Orders and tap Cancel Order. Cancellation is available until the order is packed for shipping — once it has shipped, it can no longer be cancelled from the app.',
  },
  {
    category: 'order',
    question: 'Can I change my delivery address after placing an order?',
    answer: 'The delivery address is locked in once an order is placed. If it hasn\'t shipped yet, cancel the order and place a new one with the correct address, or create a support request and we\'ll try to help before it ships.',
  },
  {
    category: 'payment',
    question: 'What payment methods are available?',
    answer: 'UPI, Credit/Debit Cards, Net Banking, and popular wallets via Razorpay, plus Cash on Delivery on orders where COD is available at checkout.',
  },
  {
    category: 'payment',
    question: 'Why did my payment fail?',
    answer: 'This is usually a bank/network issue during the Razorpay checkout — no amount is deducted for a failed payment. If money was debited but the order wasn\'t confirmed, it\'s automatically refunded to your original payment method within a few business days; if it doesn\'t reflect, raise a support request with your order or transaction reference.',
  },
  {
    category: 'delivery',
    question: 'How can I track my order?',
    answer: 'Open My Orders and select the order to see its live status on the tracking timeline — placed, confirmed, packed, shipped, out for delivery, and delivered.',
  },
  {
    category: 'delivery',
    question: 'What happens if delivery fails?',
    answer: 'If a delivery attempt fails, the order is marked accordingly and our team will arrange a re-attempt or follow up with you. You can also raise a support request directly from the order for a faster update.',
  },
  {
    category: 'return',
    question: 'How do I request a return?',
    answer: 'Once an order is marked Delivered, open it from My Orders and tap Return on the eligible item — this is available within the return window shown on your order (typically 7 days from delivery). Not every item is return-eligible; the app only shows the option where it applies.',
  },
  {
    category: 'return',
    question: 'When will I get my refund?',
    answer: 'Refunds are processed once the returned item reaches us and is inspected. You can track the return\'s status (submitted, approved, pickup scheduled, received, refunded) from the return\'s detail page.',
  },
  {
    category: 'exchange',
    question: 'How do I request an exchange?',
    answer: 'Once an order is marked Delivered, open it from My Orders and tap Exchange on the eligible item, then choose the size/color you\'d like instead. Like returns, this is only available for exchange-eligible items within the exchange window.',
  },
  {
    category: 'product',
    question: 'How do I know if a product will fit?',
    answer: 'Each product page lists material, fit, and size details under Specifications. If you\'re between sizes, our reviews often mention true-to-size feedback from other buyers.',
  },
  {
    category: 'product',
    question: 'Can I write a review for a product?',
    answer: 'Yes — once your order for that product is delivered, you can leave a rating and review from the product page or your order history.',
  },
  {
    category: 'coupon',
    question: 'Why is my coupon not working?',
    answer: 'A coupon can be inactive, expired, below its minimum order value, restricted to certain categories, limited to new customers, or already used the maximum number of times for your account. The cart screen shows the specific reason when a code doesn\'t apply.',
  },
  {
    category: 'account',
    question: 'How do I reset my password?',
    answer: 'Use Forgot Password on the login screen and follow the verification steps to set a new password.',
  },
  {
    category: 'account',
    question: 'How do I update my profile details or photo?',
    answer: 'Go to Profile from your account menu — you can update your name, phone number, and profile photo there.',
  },
  {
    category: 'account',
    question: 'How do I delete my account?',
    answer: 'Go to Settings from your account menu and choose Delete Account. This permanently removes your account and cannot be undone.',
  },
  {
    category: 'other',
    question: 'How do I contact DS LOOKS directly?',
    answer: 'Use the contact options below, or create a support request describing your issue — our team responds through the same request so you can track the conversation.',
  },
];

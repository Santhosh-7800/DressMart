import { useState } from 'react';
import { ChevronDown, Mail, MessageCircle, Phone } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { cn } from '@/lib/utils';

const FAQS = [
  { q: 'How do I track my order?', a: 'Go to My Orders or use the Track Order page with your order number to see real-time delivery status.' },
  { q: 'What is DressMart\'s return policy?', a: 'Most items can be returned within 7 days of delivery, provided they are unused and in original packaging with tags attached.' },
  { q: 'How long does delivery take?', a: 'Standard delivery typically takes 4-5 business days depending on your location. Metro cities may receive orders faster.' },
  { q: 'What payment methods are accepted?', a: 'We accept UPI, Credit/Debit Cards, Net Banking, popular Wallets, and Cash on Delivery.' },
  { q: 'How do I cancel my order?', a: 'You can cancel an order from the Order Details page as long as it hasn\'t been shipped yet.' },
  { q: 'Do you offer Cash on Delivery for all locations?', a: 'COD is available on most pin codes. If unavailable at checkout, please choose an alternate payment method.' },
];

export function HelpCenterPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="container-app py-8">
      <Seo title="Help Center" description="Get answers to common questions about orders, returns, payments and more." />
      <h1 className="mb-2 hidden text-2xl font-bold md:block">Help Center</h1>
      <p className="mb-8 text-sm text-primary-400">We're here to help. Find answers below or reach out to our support team.</p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a href="mailto:support@dressmart.com" className="card-surface flex items-center gap-3 p-4">
          <Mail size={20} className="text-accent" />
          <div>
            <p className="text-sm font-semibold">Email Us</p>
            <p className="text-xs text-primary-400">support@dressmart.com</p>
          </div>
        </a>
        <a href="tel:+911800123456" className="card-surface flex items-center gap-3 p-4">
          <Phone size={20} className="text-accent" />
          <div>
            <p className="text-sm font-semibold">Call Us</p>
            <p className="text-xs text-primary-400">1800-123-456 (Toll Free)</p>
          </div>
        </a>
        <div className="card-surface flex items-center gap-3 p-4">
          <MessageCircle size={20} className="text-accent" />
          <div>
            <p className="text-sm font-semibold">Live Chat</p>
            <p className="text-xs text-primary-400">Available 9 AM - 9 PM</p>
          </div>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-bold">Frequently Asked Questions</h2>
      <div className="card-surface divide-y divide-primary-100 dark:divide-primary-700">
        {FAQS.map((faq, idx) => (
          <div key={idx} className="p-4">
            <button onClick={() => setOpenIndex(openIndex === idx ? null : idx)} className="flex w-full items-center justify-between text-left font-medium">
              {faq.q}
              <ChevronDown size={16} className={cn('shrink-0 transition-transform', openIndex === idx && 'rotate-180')} />
            </button>
            {openIndex === idx && <p className="mt-2 text-sm text-primary-500">{faq.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

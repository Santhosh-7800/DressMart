import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Mail,
  Phone,
  LifeBuoy,
  Search,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  Repeat,
  ShoppingBag,
  Ticket,
  UserCircle,
  MoreHorizontal,
} from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { useFaqs } from '@/hooks/useSupport';
import { usePlatformSettings } from '@/hooks/useDashboardData';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_FAQS, type DefaultFaqEntry } from '@/lib/defaultFaqs';
import { cn } from '@/lib/utils';
import type { Faq, SupportCategory } from '@/types';

const CATEGORIES: { value: SupportCategory; label: string; icon: typeof Package }[] = [
  { value: 'order', label: 'Orders', icon: ShoppingBag },
  { value: 'payment', label: 'Payments', icon: CreditCard },
  { value: 'delivery', label: 'Delivery', icon: Truck },
  { value: 'return', label: 'Returns', icon: RotateCcw },
  { value: 'exchange', label: 'Exchanges', icon: Repeat },
  { value: 'product', label: 'Products', icon: Package },
  { value: 'coupon', label: 'Coupons', icon: Ticket },
  { value: 'account', label: 'Account', icon: UserCircle },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

const QUICK_ACTIONS = [
  { label: 'Track my order', to: '/orders' },
  { label: 'Cancel an order', to: '/orders' },
  { label: 'Return an item', to: '/orders' },
  { label: 'Exchange an item', to: '/orders' },
  { label: 'Payment problem', to: '/support/new?category=payment' },
  { label: 'Delivery problem', to: '/support/new?category=delivery' },
  { label: 'Coupon problem', to: '/support/new?category=coupon' },
];

export function HelpCenterPage() {
  const { isAuthenticated } = useAuth();
  const { data: settings } = usePlatformSettings();
  const faqsQuery = useFaqs();
  const [activeCategory, setActiveCategory] = useState<SupportCategory | null>(null);
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  // Falls back to the hardcoded default set only when the owner hasn't authored any FAQ content
  // yet (Firestore collection completely empty) — see lib/defaultFaqs.ts's doc comment.
  const faqs: Array<Faq | DefaultFaqEntry> = faqsQuery.data && faqsQuery.data.length > 0 ? faqsQuery.data : DEFAULT_FAQS;

  const filteredFaqs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return faqs.filter((f) => {
      if (activeCategory && f.category !== activeCategory) return false;
      if (term && !f.question.toLowerCase().includes(term) && !f.answer.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [faqs, activeCategory, search]);

  const hasEmail = Boolean(settings?.support_email);
  const hasPhone = Boolean(settings?.support_phone);

  return (
    <div className="container-app py-8">
      <Seo title="Help Center" description="Get answers to common questions about orders, returns, payments and more." />
      <h1 className="mb-2 hidden text-2xl font-bold md:block">Help Center</h1>
      <p className="mb-6 text-sm text-primary-400">We're here to help. Find answers below or reach out to our support team.</p>

      {/* Categories — large tap targets per Section 2 */}
      <div className="mb-8 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {CATEGORIES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveCategory(activeCategory === value ? null : value)}
            className={cn(
              'tap-target-48 flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center text-xs font-medium transition-colors',
              activeCategory === value ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/20' : 'border-primary-100 dark:border-primary-700',
            )}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>

      {/* Contact — reads from the Head Seller's configured Platform Settings; never a fabricated
          number/email. A card only renders when that field is actually configured. */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {hasEmail && (
          <a href={`mailto:${settings!.support_email}`} className="card-surface flex items-center gap-3 p-4">
            <Mail size={20} className="text-accent" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Email Us</p>
              <p className="truncate text-xs text-primary-400">{settings!.support_email}</p>
            </div>
          </a>
        )}
        {hasPhone && (
          <a href={`tel:${settings!.support_phone}`} className="card-surface flex items-center gap-3 p-4">
            <Phone size={20} className="text-accent" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Call Us</p>
              <p className="truncate text-xs text-primary-400">{settings!.support_phone}</p>
            </div>
          </a>
        )}
        <Link to="/support/new" className="card-surface flex items-center gap-3 p-4">
          <LifeBuoy size={20} className="text-accent" />
          <div>
            <p className="text-sm font-semibold">Create Support Request</p>
            <p className="text-xs text-primary-400">We'll respond here in the app</p>
          </div>
        </Link>
      </div>

      {isAuthenticated && (
        <div className="mb-8">
          <Link to="/support">
            <Button variant="outline" size="sm">
              <LifeBuoy size={14} /> My Support Requests
            </Button>
          </Link>
        </div>
      )}

      {/* Quick Help Actions — Section 28, reduces unnecessary tickets by routing straight to the
          existing self-service flow (order/return/exchange actions) where one already exists. */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-400">Quick Help</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.label} to={a.to} className="rounded-full border border-primary-200 px-3.5 py-2 text-sm dark:border-primary-600">
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Frequently Asked Questions</h2>
      </div>
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search help articles…"
          className="input-field pl-9"
        />
      </div>

      {filteredFaqs.length === 0 ? (
        <p className="py-10 text-center text-sm text-primary-400">No matching help articles found.</p>
      ) : (
        <div className="card-surface divide-y divide-primary-100 dark:divide-primary-700">
          {filteredFaqs.map((faq, idx) => (
            <div key={'id' in faq ? faq.id : idx} className="p-4">
              <button onClick={() => setOpenIndex(openIndex === idx ? null : idx)} className="flex w-full items-center justify-between text-left font-medium">
                {faq.question}
                <ChevronDown size={16} className={cn('shrink-0 transition-transform', openIndex === idx && 'rotate-180')} />
              </button>
              {openIndex === idx && <p className="mt-2 text-sm text-primary-500">{faq.answer}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

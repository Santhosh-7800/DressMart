import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const QUICK_FAQS = [
  { q: 'How do I track my order?', a: 'Go to My Orders or use the Track Order page with your order number to see real-time delivery status.' },
  { q: "What is DressMart's return policy?", a: 'Most items can be returned within 7 days of delivery, provided they are unused and in original packaging with tags attached.' },
  { q: 'How do I cancel my order?', a: "You can cancel an order from the Order Details page as long as it hasn't been shipped yet." },
];

/**
 * Placeholder for a future AI-backed chat assistant — this pass only ships the floating entry
 * point and a quick-FAQ panel that hands off to the full Help Center; wiring up a real LLM
 * conversation is a separate follow-up once a provider is chosen.
 */
export function ChatFab() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Chat AI"
        className="fab-above-nav tap-target-48 fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-primary-900 shadow-popover transition-transform active:scale-95 md:hidden"
      >
        <Bot size={24} />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Chat AI">
        <p className="mb-4 text-sm text-primary-500">AI chat is coming soon. In the meantime, here are quick answers — or head to the full Help Center.</p>
        <div className="mb-4 space-y-3">
          {QUICK_FAQS.map((faq) => (
            <div key={faq.q} className="rounded-lg bg-primary-50 p-3 dark:bg-primary-800">
              <p className="text-sm font-medium">{faq.q}</p>
              <p className="mt-1 text-xs text-primary-500 dark:text-primary-300">{faq.a}</p>
            </div>
          ))}
        </div>
        <Button
          className="min-h-12 w-full"
          onClick={() => {
            setIsOpen(false);
            navigate('/help-center');
          }}
        >
          Go to Help Center
        </Button>
      </Modal>
    </>
  );
}

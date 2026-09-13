import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LifeBuoy } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { useCreateTicket } from '@/hooks/useSupport';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import type { SupportCategory } from '@/types';

const CATEGORY_OPTIONS: { value: SupportCategory; label: string }[] = [
  { value: 'order', label: 'Orders' },
  { value: 'payment', label: 'Payments' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'return', label: 'Returns' },
  { value: 'exchange', label: 'Exchanges' },
  { value: 'product', label: 'Products' },
  { value: 'coupon', label: 'Coupons' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

const isSupportCategory = (v: string | null): v is SupportCategory => CATEGORY_OPTIONS.some((c) => c.value === v);

/** Reached either directly from Help Center, or via a "Need help?" shortcut from Order Details /
 *  Return / Exchange (Sections 20-23), which preselect category + the relevant reference via query
 *  params. The customer can still change the category (Section 20 explicitly allows this) and the
 *  related order. */
export function NewSupportTicketPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isOnline = useOnlineStatus();
  const { data: orders } = useOrders();
  const createTicket = useCreateTicket();

  const presetCategory = searchParams.get('category');
  const presetOrderId = searchParams.get('orderId');
  const presetReturnId = searchParams.get('returnId');
  const presetExchangeId = searchParams.get('exchangeId');

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportCategory>(isSupportCategory(presetCategory) ? presetCategory : 'other');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState(presetOrderId ?? '');

  const sortedOrders = useMemo(() => [...(orders ?? [])].sort((a, b) => +new Date(b.placed_at) - +new Date(a.placed_at)), [orders]);

  const subjectValid = subject.trim().length >= 5 && subject.trim().length <= 100;
  const messageValid = message.trim().length >= 10 && message.trim().length <= 2000;
  const canSubmit = subjectValid && messageValid && !createTicket.isPending;

  const handleSubmit = async () => {
    if (!user) return;
    if (!isOnline) {
      toast.error('Unable to send your request. Check your internet connection and try again.');
      return;
    }
    if (!subjectValid) {
      toast.error('Subject must be between 5 and 100 characters.');
      return;
    }
    if (!messageValid) {
      toast.error('Please describe your issue in 10-2000 characters.');
      return;
    }
    try {
      const ticketId = await createTicket.mutateAsync({
        userId: user.id,
        userName: user.full_name,
        subject: subject.trim(),
        category,
        message: message.trim(),
        orderId: orderId || presetOrderId || null,
        returnId: presetReturnId || null,
        exchangeId: presetExchangeId || null,
      });
      toast.success('Your support request has been received.');
      navigate(`/support/${ticketId}`, { replace: true });
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Couldn't submit your request. If you just submitted one, please wait a couple of minutes and try again."));
    }
  };

  return (
    <div className="container-app max-w-xl py-8">
      <Seo title="New Support Request" />
      <div className="mb-6 flex items-center gap-2">
        <LifeBuoy size={20} className="text-accent" />
        <h1 className="text-xl font-bold">Create Support Request</h1>
      </div>

      <div className="card-surface space-y-4 p-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={100}
            placeholder="Short summary of your issue"
            className="input-field"
          />
          <p className="mt-1 text-xs text-primary-400">{subject.trim().length}/100</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)} className="input-field">
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {sortedOrders.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">Related order (optional)</label>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="input-field">
              <option value="">Not related to a specific order</option>
              {sortedOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.order_number} · {o.items[0]?.product_name}
                  {o.items.length > 1 ? ` +${o.items.length - 1} more` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Describe your issue in detail…"
            className="input-field"
          />
          <p className="mt-1 text-xs text-primary-400">{message.trim().length}/2000 (minimum 10)</p>
        </div>

        <Button variant="accent" fullWidth onClick={handleSubmit} isLoading={createTicket.isPending} disabled={!canSubmit}>
          Submit Request
        </Button>
      </div>
    </div>
  );
}

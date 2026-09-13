import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { Megaphone } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { functions } from '@/lib/firebase';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';

const MAX_TITLE = 80;
const MAX_MESSAGE = 200;

/** Head-Seller-only broadcast to every buyer — see broadcastPromotionalNotification.ts for why
 *  this has to be a Cloud Function rather than a client-side loop (a customer's own notifications
 *  rule only allows THEM to create a doc for their own uid, never another account writing for them). */
export function NotifyCustomersCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');

  const broadcast = useMutation({
    mutationFn: async () => {
      const call = httpsCallable<{ title: string; message: string; link?: string }, { success: true; recipientCount: number }>(
        functions,
        'broadcastPromotionalNotification',
      );
      const { data } = await call({ title: title.trim(), message: message.trim(), link: link.trim() || undefined });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sent to ${data.recipientCount} customer${data.recipientCount === 1 ? '' : 's'}`);
      setIsOpen(false);
      setTitle('');
      setMessage('');
      setLink('');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not send this notification.')),
  });

  return (
    <>
      <Card hover={false} className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
            <Megaphone size={20} />
          </div>
          <div>
            <p className="font-semibold text-acc-text dark:text-white">Notify Customers</p>
            <p className="text-xs text-acc-text-secondary">Send a one-time promotional notification to every customer.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Megaphone size={14} /> Send Notification
        </Button>
      </Card>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Notify Customers">
        <div className="space-y-4">
          <Input
            floating
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
            placeholder="New festive offers are now available"
          />
          <div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              placeholder="Get up to 30% off on the festive collection, this week only."
              rows={3}
              className="input-field w-full resize-none"
            />
            <p className="mt-1 text-right text-xs text-primary-400">{message.length}/{MAX_MESSAGE}</p>
          </div>
          <Input floating label="Link (optional)" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/category/formal-shirts" />
          <p className="text-xs text-primary-400">This sends immediately to every customer account. Use it sparingly.</p>
          <Button
            variant="accent"
            fullWidth
            onClick={() => broadcast.mutate()}
            isLoading={broadcast.isPending}
            disabled={!title.trim() || !message.trim()}
          >
            Send Now
          </Button>
        </div>
      </Modal>
    </>
  );
}

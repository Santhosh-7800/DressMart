import { useState } from 'react';
import { CreditCard, Plus, Trash2, Smartphone } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useSavedPayments } from '@/hooks/useSavedPayments';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

export function SavedPaymentsPage() {
  const { methods, add, remove } = useSavedPayments();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState<'card' | 'upi'>('card');
  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');
  const [upiId, setUpiId] = useState('');

  const handleAdd = async () => {
    await add({
      type,
      label: label || (type === 'card' ? 'My Card' : 'My UPI'),
      last4: type === 'card' ? last4.slice(-4) : null,
      upi_id: type === 'upi' ? upiId : null,
      is_default: methods.length === 0,
    });
    setIsModalOpen(false);
    setLabel('');
    setLast4('');
    setUpiId('');
  };

  return (
    <div>
      <Seo title="Saved Payments" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved Payment Methods</h1>
        <Button variant="accent" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={15} /> Add New
        </Button>
      </div>

      {methods.length === 0 ? (
        <EmptyState icon={CreditCard} title="No saved payment methods" description="Save a card or UPI ID for faster checkout next time." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {methods.map((method) => (
            <div key={method.id} className={cn('card-surface flex items-center justify-between p-4', method.is_default && 'ring-2 ring-accent')}>
              <div className="flex items-center gap-3">
                {method.type === 'card' ? <CreditCard size={20} className="text-primary-400" /> : <Smartphone size={20} className="text-primary-400" />}
                <div>
                  <p className="text-sm font-medium">{method.label}</p>
                  <p className="text-xs text-primary-400">{method.type === 'card' ? `•••• ${method.last4}` : method.upi_id}</p>
                </div>
              </div>
              <button onClick={() => remove(method.id)} className="text-red-500" aria-label="Remove payment method">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Payment Method">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setType('card')} className={cn('flex-1 rounded-lg border py-2 text-sm', type === 'card' ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600')}>
              Card
            </button>
            <button onClick={() => setType('upi')} className={cn('flex-1 rounded-lg border py-2 text-sm', type === 'upi' ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600')}>
              UPI
            </button>
          </div>
          <Input label="Label" placeholder="e.g. Personal Card" value={label} onChange={(e) => setLabel(e.target.value)} />
          {type === 'card' ? (
            <Input label="Card Number" placeholder="1234 5678 9012 3456" value={last4} onChange={(e) => setLast4(e.target.value)} />
          ) : (
            <Input label="UPI ID" placeholder="yourname@bank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
          )}
          <Button variant="accent" fullWidth onClick={handleAdd}>
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}

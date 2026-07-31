import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { RETURN_REASONS } from '@/lib/returnStatus';
import { useRequestReturn } from '@/hooks/useReturns';
import type { Order, OrderItem } from '@/types';

interface ReturnRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  item: OrderItem;
}

export function ReturnRequestModal({ isOpen, onClose, order, item }: ReturnRequestModalProps) {
  const requestReturn = useRequestReturn();
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    await requestReturn.mutateAsync({ order, orderItemId: item.id, reason, comment });
    setComment('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request a Return">
      <div className="space-y-3">
        <p className="text-sm text-primary-500">{item.product_name}</p>
        <div>
          <p className="mb-1.5 text-sm font-medium">Reason for return</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field">
            {RETURN_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Additional comments (optional)</p>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="input-field" rows={3} />
        </div>
        <Button variant="accent" fullWidth onClick={handleSubmit} isLoading={requestReturn.isPending}>
          Submit Return Request
        </Button>
      </div>
    </Modal>
  );
}

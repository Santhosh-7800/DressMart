import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAssignDelivery } from '@/hooks/useDelivery';
import type { Order, Profile } from '@/types';

/** Shared by SellerOrdersPage (per-order quick action) and SellerDeliveryManagementPage (the
 *  dedicated Delivery Management screen) — one modal, one Cloud Function call, everywhere an owner
 *  can assign or reassign a delivery. */
export function AssignDeliveryModal({ order, roster, onClose }: { order: Order | null; roster: Profile[]; onClose: () => void }) {
  const assign = useAssignDelivery();
  const [selected, setSelected] = useState('');
  const activeRoster = roster.filter((r) => r.delivery_staff_status !== 'inactive');

  const handleAssign = () => {
    if (!order || !selected) return;
    assign.mutate(
      { orderId: order.id, deliveryStaffId: selected },
      { onSuccess: () => { onClose(); setSelected(''); } },
    );
  };

  return (
    <Modal isOpen={Boolean(order)} onClose={onClose} title={order?.delivery_staff_id ? 'Reassign Delivery' : 'Assign Delivery'}>
      <div className="space-y-3">
        <p className="text-sm text-primary-500 dark:text-primary-300">
          Order #{order?.order_number} — {order?.address.full_name}
        </p>
        {order?.delivery_staff_name && <p className="text-xs text-primary-400">Currently: {order.delivery_staff_name}</p>}
        {activeRoster.length === 0 ? (
          <p className="text-sm text-primary-400">No active delivery personnel available. Add one from Delivery Management first.</p>
        ) : (
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input-field w-full">
            <option value="">Select a delivery person</option>
            {activeRoster.map((r) => (
              <option key={r.id} value={r.id} disabled={r.id === order?.delivery_staff_id}>
                {r.full_name} {r.id === order?.delivery_staff_id ? '(current)' : ''}
              </option>
            ))}
          </select>
        )}
        <Button variant="accent" fullWidth onClick={handleAssign} isLoading={assign.isPending} disabled={!selected}>
          Confirm
        </Button>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import toast from 'react-hot-toast';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useAddresses } from '@/hooks/useAddresses';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import type { Address } from '@/types';

type AddressFormState = Omit<Address, 'id' | 'user_id' | 'is_default'>;

const EMPTY_FORM: AddressFormState = { full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', landmark: '', type: 'home' };

export function AddressesPage() {
  const { addresses, addAddress, updateAddress, removeAddress } = useAddresses();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (address: Address) => {
    setEditingId(address.id);
    setForm({ full_name: address.full_name, phone: address.phone, line1: address.line1, line2: address.line2 ?? '', city: address.city, state: address.state, pincode: address.pincode, landmark: address.landmark ?? '', type: address.type });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      toast.error('Please fill in all required fields');
      return;
    }
    const payload = { ...form, line2: form.line2 || null, landmark: form.landmark || null };
    if (editingId) {
      await updateAddress({ addressId: editingId, updates: payload });
    } else {
      await addAddress({ ...payload, is_default: addresses.length === 0 });
    }
    setIsModalOpen(false);
  };

  return (
    <div>
      <Seo title="My Addresses" />
      <div className="mb-6 flex items-center justify-end md:justify-between">
        <h1 className="hidden text-2xl font-bold md:block">My Addresses</h1>
        <Button variant="accent" size="sm" onClick={openAddModal}>
          <Plus size={15} /> Add Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState icon={MapPin} title="No addresses saved" description="Add a delivery address for faster checkout." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <div key={address.id} className={cn('card-surface p-4', address.is_default && 'ring-2 ring-accent')}>
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium uppercase dark:bg-primary-700">{address.type}</span>
                {address.is_default && <span className="text-xs font-semibold text-accent-600">Default</span>}
              </div>
              <p className="text-sm font-semibold">{address.full_name}</p>
              <p className="text-sm text-primary-500">
                {address.line1}, {address.line2 ? `${address.line2}, ` : ''}
                {address.city}, {address.state} - {address.pincode}
              </p>
              <p className="text-xs text-primary-400">Phone: {address.phone}</p>
              <div className="mt-3 flex gap-3 text-xs">
                <button onClick={() => openEditModal(address)} className="flex items-center gap-1 text-accent-600 hover:underline">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => removeAddress(address.id)} className="flex items-center gap-1 text-red-500 hover:underline">
                  <Trash2 size={12} /> Remove
                </button>
                {!address.is_default && (
                  <button onClick={() => updateAddress({ addressId: address.id, updates: { is_default: true } })} className="text-primary-400 hover:underline">
                    Set as default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Address' : 'Add New Address'}>
        <div className="space-y-3">
          <Input name="full_name" label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input name="phone" label="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input name="line1" label="Address Line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
          <Input name="line2" label="Address Line 2 (optional)" value={form.line2 ?? ''} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input name="city" label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input name="state" label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="pincode" label="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            <Input name="landmark" label="Landmark (optional)" value={form.landmark ?? ''} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Address Type</p>
            <div className="flex gap-2">
              {(['home', 'work', 'other'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setForm({ ...form, type })}
                  className={cn('rounded-lg border px-3 py-1.5 text-xs capitalize', form.type === type ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600')}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <Button variant="accent" fullWidth onClick={handleSave}>
            Save Address
          </Button>
        </div>
      </Modal>
    </div>
  );
}

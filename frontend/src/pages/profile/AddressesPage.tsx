import { useState } from 'react';
import toast from 'react-hot-toast';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useAddresses } from '@/hooks/useAddresses';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { AddressFormFields } from '@/components/address/AddressFormFields';
import { EMPTY_ADDRESS_FORM, isAddressFormValid, type AddressFormValues } from '@/lib/addressValidation';
import { cn } from '@/lib/utils';
import type { Address } from '@/types';

export function AddressesPage() {
  const { addresses, addAddress, updateAddress, removeAddress } = useAddresses();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormValues>(EMPTY_ADDRESS_FORM);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_ADDRESS_FORM);
    setSubmitAttempted(false);
    setIsModalOpen(true);
  };

  const openEditModal = (address: Address) => {
    setEditingId(address.id);
    setForm({ full_name: address.full_name, phone: address.phone, line1: address.line1, line2: address.line2 ?? '', city: address.city, state: address.state, pincode: address.pincode, landmark: address.landmark ?? '', type: address.type });
    setSubmitAttempted(false);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!isAddressFormValid(form)) {
      setSubmitAttempted(true);
      toast.error('Please fix the highlighted fields');
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...form, line2: form.line2 || null, landmark: form.landmark || null };
      if (editingId) {
        await updateAddress({ addressId: editingId, updates: payload });
      } else {
        await addAddress({ ...payload, is_default: addresses.length === 0 });
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
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
        <AddressFormFields value={form} onChange={setForm} submitAttempted={submitAttempted} />
        <Button variant="accent" fullWidth className="mt-3" onClick={handleSave} isLoading={isSaving} disabled={!isAddressFormValid(form)}>
          Save Address
        </Button>
      </Modal>
    </div>
  );
}

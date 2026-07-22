import { Link } from 'react-router-dom';
import { Check, MapPin, Plus } from 'lucide-react';
import { PincodeChecker } from '@/components/product/PincodeChecker';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';
import type { Address } from '@/types';

interface DeliveryDropdownProps {
  onClose: () => void;
}

/**
 * The navbar's delivery pincode is normally driven by a saved address, not a freehand pincode —
 * picking an address here updates dressmart:pincode (the same key PincodeChecker/estimated-delivery
 * logic already reads) so the rest of the app doesn't need to know addresses exist. The manual
 * pincode checker is kept as a fallback for guests and for anyone with no saved addresses yet.
 */
export function DeliveryDropdown({ onClose }: DeliveryDropdownProps) {
  const { isAuthenticated } = useAuth();
  const { addresses, isLoading } = useAddresses();
  const [, setPincode] = useLocalStorage('dressmart:pincode', '400001');
  const [selectedAddressId, setSelectedAddressId] = useLocalStorage('dressmart:selected-address-id', '');

  const hasAddresses = isAuthenticated && addresses.length > 0;

  const handleSelectAddress = (address: Address) => {
    setPincode(address.pincode);
    setSelectedAddressId(address.id);
    onClose();
  };

  if (isAuthenticated && isLoading) {
    return (
      <div className="absolute left-0 top-full mt-2 w-80 rounded-xl bg-card p-4 text-primary-900 shadow-popover dark:bg-card-dark dark:text-white">
        <div className="skeleton h-16 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="absolute left-0 top-full mt-2 w-80 rounded-xl bg-card p-4 text-primary-900 shadow-popover dark:bg-card-dark dark:text-white">
      {hasAddresses ? (
        <>
          <p className="mb-2 text-sm font-semibold">Deliver to</p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {addresses.map((address) => {
              const isSelected = address.id === selectedAddressId || (!selectedAddressId && address.is_default);
              return (
                <button
                  key={address.id}
                  onClick={() => handleSelectAddress(address)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors',
                    isSelected
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20'
                      : 'border-primary-100 hover:bg-primary-50 dark:border-primary-700 dark:hover:bg-primary-800',
                  )}
                >
                  <MapPin size={14} className={cn('mt-0.5 shrink-0', isSelected ? 'text-accent-600' : 'text-primary-300')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {address.full_name}
                      <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
                        {address.type}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-primary-500 dark:text-primary-300">
                      {address.line1}, {address.city}, {address.state} - {address.pincode}
                    </span>
                  </span>
                  {isSelected && <Check size={14} className="mt-0.5 shrink-0 text-accent-600" />}
                </button>
              );
            })}
          </div>
          <Link
            to="/addresses"
            onClick={onClose}
            className="mt-3 flex items-center gap-1 border-t border-primary-100 pt-3 text-sm font-medium text-accent-600 hover:underline dark:border-primary-700"
          >
            <Plus size={14} /> Add a new address
          </Link>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm font-semibold">{isAuthenticated ? 'No saved addresses yet' : 'Check delivery to your pincode'}</p>
          <PincodeChecker onVerified={onClose} />
          <Link
            to={isAuthenticated ? '/addresses' : '/login'}
            onClick={onClose}
            className="mt-3 block border-t border-primary-100 pt-3 text-sm font-medium text-accent-600 hover:underline dark:border-primary-700"
          >
            {isAuthenticated ? 'Add a delivery address' : 'Login to save an address'}
          </Link>
        </>
      )}
    </div>
  );
}

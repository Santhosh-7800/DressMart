import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { addressService } from '@/services/addressService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { Address } from '@/types';

export function useAddresses() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...queryKeys.addresses.all, identityId],
    queryFn: () => addressService.list(identityId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...queryKeys.addresses.all, identityId] });

  const addAddress = useMutation({
    mutationFn: (address: Omit<Address, 'id' | 'user_id'>) => addressService.add(identityId, address),
    onSuccess: () => {
      invalidate();
      toast.success('Address saved');
    },
  });

  const updateAddress = useMutation({
    mutationFn: ({ addressId, updates }: { addressId: string; updates: Partial<Address> }) => addressService.update(identityId, addressId, updates),
    onSuccess: () => {
      invalidate();
      toast.success('Address updated');
    },
  });

  const removeAddress = useMutation({
    mutationFn: (addressId: string) => addressService.remove(identityId, addressId),
    onSuccess: () => {
      invalidate();
      toast('Address removed', { icon: '🗑️' });
    },
  });

  return {
    addresses: query.data ?? [],
    isLoading: query.isLoading,
    addAddress: addAddress.mutateAsync,
    updateAddress: updateAddress.mutateAsync,
    removeAddress: removeAddress.mutateAsync,
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { wishlistCollectionService } from '@/services/wishlistCollectionService';
import { useAuth } from '@/contexts/AuthContext';
import type { WishlistCollection } from '@/types';

export function useWishlistCollections() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['wishlist-collections', identityId];

  const query = useQuery({ queryKey, queryFn: () => wishlistCollectionService.list(identityId) });

  const applyResult = (data: WishlistCollection[]) => queryClient.setQueryData(queryKey, data);

  const create = useMutation({
    mutationFn: (name: string) => wishlistCollectionService.create(identityId, name),
    onSuccess: (data) => {
      applyResult(data);
      toast.success('Collection created');
    },
  });

  const rename = useMutation({
    mutationFn: ({ collectionId, name }: { collectionId: string; name: string }) => wishlistCollectionService.rename(identityId, collectionId, name),
    onSuccess: (data) => {
      applyResult(data);
      toast.success('Collection renamed');
    },
  });

  const remove = useMutation({
    mutationFn: (collectionId: string) => wishlistCollectionService.remove(identityId, collectionId),
    onSuccess: (data) => {
      applyResult(data);
      toast('Collection deleted', { icon: '🗑️' });
    },
  });

  const moveProduct = useMutation({
    mutationFn: ({ productId, toCollectionId }: { productId: string; toCollectionId: string | null }) =>
      wishlistCollectionService.moveProduct(identityId, productId, toCollectionId),
    onSuccess: applyResult,
  });

  const share = useMutation({
    mutationFn: (collectionId: string) => wishlistCollectionService.share(identityId, collectionId),
    onSuccess: applyResult,
  });

  const unshare = useMutation({
    mutationFn: (collectionId: string) => wishlistCollectionService.unshare(identityId, collectionId),
    onSuccess: (data) => {
      applyResult(data);
      toast('Sharing turned off', { icon: '🔒' });
    },
  });

  return {
    collections: query.data ?? [],
    isLoading: query.isLoading,
    create: create.mutateAsync,
    rename: rename.mutateAsync,
    remove: remove.mutateAsync,
    moveProduct: moveProduct.mutateAsync,
    share: share.mutateAsync,
    unshare: unshare.mutateAsync,
  };
}

export function useSharedWishlistCollection(shareSlug: string | undefined) {
  return useQuery({
    queryKey: ['wishlist-shared', shareSlug],
    queryFn: () => wishlistCollectionService.getShared(shareSlug as string),
    enabled: Boolean(shareSlug),
  });
}

import { useState } from 'react';
import { Copy, Check, Share2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { WishlistCollection } from '@/types';

interface ShareCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: WishlistCollection | null;
  onShare: (collectionId: string) => Promise<unknown>;
  onUnshare: (collectionId: string) => Promise<unknown>;
}

export function ShareCollectionModal({ isOpen, onClose, collection, onShare, onUnshare }: ShareCollectionModalProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  if (!collection) return null;

  const shareUrl = collection.share_slug ? `${window.location.origin}/wishlist/shared/${collection.share_slug}` : null;

  const handleEnableSharing = async () => {
    setIsWorking(true);
    try {
      await onShare(collection.id);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisableSharing = async () => {
    setIsWorking(true);
    try {
      await onUnshare(collection.id);
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    toast.success('Link copied');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${collection.name}"`}>
      {shareUrl ? (
        <div className="space-y-3">
          <p className="text-sm text-primary-400">Anyone with this link can view the products in this collection.</p>
          <div className="flex items-center gap-2 rounded-xl border border-primary-200 p-2.5 dark:border-primary-600">
            <input readOnly value={shareUrl} className="flex-1 truncate bg-transparent text-sm outline-none" />
            <button onClick={handleCopy} className="flex shrink-0 items-center gap-1 rounded-lg bg-primary-100 px-2.5 py-1.5 text-xs font-medium dark:bg-primary-700">
              {isCopied ? <Check size={13} /> : <Copy size={13} />}
              {isCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <Button variant="outline" fullWidth onClick={handleDisableSharing} isLoading={isWorking}>
            <Lock size={14} /> Stop Sharing
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-center">
          <p className="text-sm text-primary-400">Generate a public link so others can view the products in this collection.</p>
          <Button variant="accent" fullWidth onClick={handleEnableSharing} isLoading={isWorking}>
            <Share2 size={14} /> Create Share Link
          </Button>
        </div>
      )}
    </Modal>
  );
}

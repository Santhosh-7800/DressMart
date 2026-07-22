import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface CollectionNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
  initialName?: string;
  title: string;
  submitLabel: string;
}

export function CollectionNameModal({ isOpen, onClose, onSubmit, initialName = '', title, submitLabel }: CollectionNameModalProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setError(null);
    }
  }, [isOpen, initialName]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give your collection a name.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-3">
        <Input
          label="Collection Name"
          placeholder="e.g. Birthday Gifts"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          error={error ?? undefined}
          autoFocus
        />
        <Button variant="accent" fullWidth onClick={handleSubmit} isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </Modal>
  );
}

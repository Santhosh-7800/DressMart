import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ImagePlus, X } from 'lucide-react';
import { StarRatingInput } from '@/components/ui/Rating';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { useReviewableOrderItems, useSubmitReview } from '@/hooks/useProducts';

/**
 * Only renders a usable form for a signed-in customer with at least one delivered,
 * not-yet-reviewed order item for this product — reviews are gated on verified purchase,
 * one per order item, both here and (for a live Supabase project) at the RLS layer.
 */
export function WriteReviewForm({ productId }: { productId: string }) {
  const { isAuthenticated, user } = useAuth();
  const { avatarUrl } = useAvatar();
  const { data: reviewableItems, isLoading } = useReviewableOrderItems(user?.id, productId);
  const submitReview = useSubmitReview();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);

  if (!isAuthenticated) {
    return (
      <p className="text-sm text-primary-400">
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>{' '}
        to write a review for products you&apos;ve purchased.
      </p>
    );
  }

  if (isLoading) return null;

  const items = reviewableItems ?? [];
  if (items.length === 0) return null;

  const activeItem = items.find((i) => i.order_item_id === selectedOrderItemId) ?? items[0];

  const resetForm = () => {
    setRating(0);
    setTitle('');
    setText('');
    setImageUrl('');
    setImages([]);
    setSelectedOrderItemId(null);
    setIsOpen(false);
  };

  const handleAddImage = () => {
    const url = imageUrl.trim();
    if (!url) return;
    setImages((prev) => [...prev, url]);
    setImageUrl('');
  };

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error('Please select a star rating');
      return;
    }
    if (!user) return;
    try {
      await submitReview.mutateAsync({
        input: {
          product_id: productId,
          user_id: user.id,
          order_id: activeItem.order_id,
          order_item_id: activeItem.order_item_id,
          rating,
          review_title: title.trim() || undefined,
          review_text: text.trim() || undefined,
          images,
        },
        userName: user.full_name,
        userAvatar: user.avatar_url,
      });
      toast.success('Thanks for your review!');
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit your review');
    }
  };

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Write a Review
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-primary-100 p-4 dark:border-primary-700">
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar src={avatarUrl} name={user?.full_name ?? ''} size="sm" />
        <h3 className="text-sm font-semibold">Write a Review</h3>
      </div>

      {items.length > 1 && (
        <label className="mb-3 block text-sm">
          <span className="mb-1.5 block font-medium text-primary-800 dark:text-primary-100">Which purchase are you reviewing?</span>
          <select
            className="input-field"
            value={activeItem.order_item_id}
            onChange={(e) => setSelectedOrderItemId(e.target.value)}
          >
            {items.map((item) => (
              <option key={item.order_item_id} value={item.order_item_id}>
                Order {item.order_number} — {item.color}, {item.size}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mb-4">
        <span className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Your Rating</span>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <div className="mb-4">
        <Input label="Review Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum up your experience" />
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Your Review (optional)</label>
        <textarea
          className="input-field min-h-24"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you like or dislike?"
        />
      </div>

      <div className="mb-4">
        <span className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Photos (optional)</span>
        <div className="flex flex-wrap items-center gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt={`Attached ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-900 text-white"
                aria-label="Remove image"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Paste an image URL" className="text-sm" />
          <Button type="button" variant="outline" size="sm" onClick={handleAddImage}>
            <ImagePlus size={14} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="accent" onClick={handleSubmit} isLoading={submitReview.isPending}>
          Submit Review
        </Button>
        <Button variant="ghost" onClick={resetForm}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

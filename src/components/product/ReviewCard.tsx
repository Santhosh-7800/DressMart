import { ThumbsUp, BadgeCheck } from 'lucide-react';
import type { Review } from '@/types';
import { formatDate } from '@/lib/utils';
import { Rating } from '@/components/ui/Rating';
import { Avatar } from '@/components/ui/Avatar';

export function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="border-b border-primary-100 py-4 last:border-0 dark:border-primary-700">
      <div className="flex gap-3">
        <Avatar src={review.user_avatar} name={review.user_name} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Rating value={review.rating} />
            {review.review_title && <h4 className="text-sm font-semibold">{review.review_title}</h4>}
          </div>
          {review.review_text && <p className="text-sm text-primary-600 dark:text-primary-200">{review.review_text}</p>}
          {review.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {review.images.map((url, i) => (
                <img key={i} src={url} alt={`Review photo ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-primary-400">
            <span className="font-medium text-primary-600 dark:text-primary-300">{review.user_name}</span>
            <span>{formatDate(review.created_at)}</span>
            {review.is_verified_purchase && (
              <span className="flex items-center gap-1 text-emerald-600">
                <BadgeCheck size={12} /> Verified Purchase
              </span>
            )}
            <button className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-200">
              <ThumbsUp size={12} /> Helpful ({review.helpful_count})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

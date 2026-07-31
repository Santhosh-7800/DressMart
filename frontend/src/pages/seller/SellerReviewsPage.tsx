import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageSquare, BadgeCheck } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Rating } from '@/components/ui/Rating';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { reviewService } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';

export function SellerReviewsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ['reviews', 'seller', user?.id ?? ''],
    queryFn: () => reviewService.listForSeller(user!.id),
    enabled: Boolean(user?.id),
  });

  const replyMutation = useMutation({
    mutationFn: ({ reviewId, text }: { reviewId: string; text: string }) => reviewService.replyToReview(reviewId, text),
    onSuccess: (_data, { reviewId }) => {
      toast.success('Reply posted');
      queryClient.invalidateQueries({ queryKey: ['reviews', 'seller', user?.id ?? ''] });
      const review = (reviewsQuery.data ?? []).find((r) => r.id === reviewId);
      if (review) queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byProduct(review.product_id) });
      setEditingReviewId(null);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not post reply.'),
  });

  const reviews = reviewsQuery.data ?? [];

  const handleSubmitReply = (reviewId: string) => {
    const text = (replyDrafts[reviewId] ?? '').trim();
    if (!text) {
      toast.error('Write a reply before submitting.');
      return;
    }
    replyMutation.mutate({ reviewId, text });
  };

  return (
    <div className="space-y-6">
      <Seo title="Reviews" />
      <h1 className="text-2xl font-bold text-acc-text dark:text-white">Reviews</h1>

      {reviewsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No reviews yet" description="Reviews on your products will show up here." />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const isEditing = editingReviewId === review.id || !review.seller_reply;
            return (
              <Card key={review.id} hover={false}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <Link to={`/product/${review.product_slug}`} className="text-sm font-semibold text-accent-600 hover:underline">
                      {review.product_name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <Rating value={review.rating} />
                      {review.is_verified_purchase && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <BadgeCheck size={12} /> Verified Purchase
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-acc-text-secondary">{formatDate(review.created_at)}</p>
                </div>
                {review.review_title && <p className="text-sm font-semibold text-acc-text dark:text-white">{review.review_title}</p>}
                {review.review_text && <p className="mt-1 text-sm text-acc-text-secondary">{review.review_text}</p>}
                <p className="mt-2 text-xs text-acc-text-secondary">— {review.user_name}</p>

                {review.seller_reply && !isEditing && (
                  <div className="mt-3 rounded-lg bg-primary-50 p-3 dark:bg-primary-800">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-primary-700 dark:text-primary-200">Your response</p>
                      <button className="text-xs text-accent-600 hover:underline" onClick={() => setEditingReviewId(review.id)}>
                        Edit
                      </button>
                    </div>
                    <p className="text-sm text-primary-600 dark:text-primary-300">{review.seller_reply.text}</p>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="input-field min-h-[80px]"
                      placeholder="Write a reply to this review…"
                      value={replyDrafts[review.id] ?? review.seller_reply?.text ?? ''}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="account" onClick={() => handleSubmitReply(review.id)} isLoading={replyMutation.isPending}>
                        {review.seller_reply ? 'Save Reply' : 'Post Reply'}
                      </Button>
                      {review.seller_reply && (
                        <Button size="sm" variant="outline" onClick={() => setEditingReviewId(null)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

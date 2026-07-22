import type { RatingSummary } from '@/types';
import { Star } from 'lucide-react';

export function ReviewsSummary({ summary }: { summary: RatingSummary }) {
  const { average_rating: rating, total_reviews: total } = summary;
  const distribution = [
    { star: 5, count: summary.rating_5 },
    { star: 4, count: summary.rating_4 },
    { star: 3, count: summary.rating_3 },
    { star: 2, count: summary.rating_2 },
    { star: 1, count: summary.rating_1 },
  ];

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-50 px-8 py-6 dark:bg-primary-800">
        <p className="text-4xl font-bold">{rating.toFixed(1)}</p>
        <div className="my-1 flex text-accent">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={16} className={i < Math.round(rating) ? 'fill-accent' : 'text-primary-200'} />
          ))}
        </div>
        <p className="text-xs text-primary-400">{total.toLocaleString('en-IN')} ratings</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {distribution.map(({ star, count }) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0">{star} star</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-700">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-primary-400">{count.toLocaleString('en-IN')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

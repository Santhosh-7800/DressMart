import type { RefObject } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollSentinelProps {
  sentinelRef: RefObject<HTMLDivElement | null>;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  hasResults: boolean;
}

/** Invisible trigger div an IntersectionObserver watches to load the next page, plus the loading/
 *  end-of-list states around it — shared by every infinite-scroll product list (see
 *  useInfiniteProductListing). */
export function InfiniteScrollSentinel({ sentinelRef, hasNextPage, isFetchingNextPage, hasResults }: InfiniteScrollSentinelProps) {
  if (!hasResults) return null;

  return (
    <div className="py-6">
      {hasNextPage && <div ref={sentinelRef} aria-hidden className="h-1 w-full" />}
      {isFetchingNextPage && (
        <div className="flex justify-center">
          <Loader2 className="animate-spin text-primary-300" size={22} />
        </div>
      )}
      {!hasNextPage && !isFetchingNextPage && (
        <p className="text-center text-xs text-primary-400">You've reached the end of the list</p>
      )}
    </div>
  );
}

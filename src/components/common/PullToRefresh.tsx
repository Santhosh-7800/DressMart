import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | unknown;
  children: ReactNode;
}

const THRESHOLD = 70;

/** Wraps a scrollable page's content with a native-feeling pull-to-refresh gesture (mobile only —
 *  desktop has no touch input to pull with, so the indicator never grows there). */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { pullDistance, isRefreshing, handlers } = usePullToRefresh(onRefresh, THRESHOLD);
  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div {...handlers}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 md:hidden"
        style={{ height: isRefreshing ? THRESHOLD : pullDistance }}
      >
        <RefreshCw
          size={22}
          className={cn('text-accent', isRefreshing && 'animate-spin')}
          style={isRefreshing ? undefined : { opacity: progress, transform: `rotate(${progress * 360}deg)` }}
        />
      </div>
      {children}
    </div>
  );
}

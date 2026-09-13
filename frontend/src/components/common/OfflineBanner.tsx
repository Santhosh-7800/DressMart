import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Non-blocking, session-wide connectivity banner — complements CatalogHealthGate (a one-shot
 * check at boot) by reacting if connectivity drops or returns *after* the app has already loaded.
 * Deliberately doesn't cover the page: cached products/pages stay visible and browsable
 * underneath (Firestore's own offline persistence — see firebase.ts — keeps serving cached reads
 * regardless of this banner), and reconnecting auto-refetches every active query rather than
 * requiring the shopper to manually reload.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (isOnline && wasOffline.current) {
      queryClient.refetchQueries({ type: 'active' });
    }
    wasOffline.current = !isOnline;
  }, [isOnline, queryClient]);

  if (isOnline) return null;

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 pb-2 text-center text-xs font-medium text-white sm:text-sm"
      // Tailwind's .pt-safe utility would replace py-2's top half outright rather than add to it —
      // this keeps the same 0.5rem breathing room on web/desktop (where the inset is 0) while still
      // clearing the status bar on native Android, mirroring BottomNavBar's pb-nav-safe pattern.
      style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
    >
      <WifiOff size={15} className="shrink-0" />
      <span>No Internet Connection — showing cached products</span>
      <button
        onClick={() => queryClient.refetchQueries({ type: 'active' })}
        className="tap-target-48 relative flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/30"
      >
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}

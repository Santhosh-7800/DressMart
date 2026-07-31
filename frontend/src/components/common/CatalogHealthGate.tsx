import { useState, type ReactNode } from 'react';
import { PackageSearch, WifiOff, Loader2 } from 'lucide-react';
import { useCatalogHealth } from '@/hooks/useCatalogHealth';
import { Button } from '@/components/ui/Button';

/**
 * Wraps the whole app shell (see App.tsx) with a one-time, app-boot check that products actually
 * exist — so a Firestore hiccup or an empty local emulator shows a clear, actionable screen instead
 * of every page silently rendering blank product grids. Once the check passes, this renders nothing
 * extra and never re-checks (page-level empty states, e.g. "no results for this filter", are each
 * page's own concern, not this component's).
 */
export function CatalogHealthGate({ children }: { children: ReactNode }) {
  const { status, retry, isEmulator } = useCatalogHealth();
  const [dismissed, setDismissed] = useState(false);

  if (status === 'ok' || dismissed) return <>{children}</>;

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-4 text-center dark:bg-surface-dark">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-sm text-primary-400 dark:text-primary-300">Preparing product catalog...</p>
      </div>
    );
  }

  const isEmpty = status === 'empty';
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4 text-center dark:bg-surface-dark">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-800">
        {isEmpty ? <PackageSearch size={28} className="text-primary-400" /> : <WifiOff size={28} className="text-primary-400" />}
      </div>
      <div>
        <h2 className="text-lg font-semibold">{isEmpty ? 'No products available right now' : "Can't connect right now"}</h2>
        <p className="mt-1.5 max-w-sm text-sm text-primary-400 dark:text-primary-300">
          {isEmpty
            ? isEmulator
              ? 'The local catalog looks empty — this usually means the Firebase emulator was restarted. Run `npm run emulators` if it isn\'t running, then retry (it auto-seeds on the next `npm run dev`).'
              : "We couldn't find any products just yet. Please check back soon."
            : 'We couldn\'t reach the DressMart servers. Check your connection and try again.'}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="accent" onClick={retry}>
          Retry
        </Button>
        {isEmpty && (
          <Button variant="outline" onClick={() => setDismissed(true)}>
            Continue anyway
          </Button>
        )}
      </div>
    </div>
  );
}

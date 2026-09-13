import { useEffect, useState, type ReactNode } from 'react';
import { PackageSearch, WifiOff } from 'lucide-react';
import { useCatalogHealth } from '@/hooks/useCatalogHealth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { SplashScreen } from '@/components/common/SplashScreen';

/** Floor so a fast cold start (catalog + auth both resolving in well under a second) doesn't flash
 *  the branded splash on and back off again — it stays up at least this long once shown. */
const MIN_SPLASH_MS = 900;
/** Defense-in-depth only: AuthContext's own onAuthStateChanged has no timeout of its own (a hung
 *  listener would otherwise wait forever). This never changes what isAuthenticated actually is —
 *  it only stops the splash from waiting on it, so RootGate (which reads live auth state
 *  independently) still reacts correctly whenever auth actually does resolve, sooner or later. */
const AUTH_WAIT_TIMEOUT_MS = 8000;
/** How long SplashScreen's own fade/scale-out transition takes (see its `duration-300`) — kept in
 *  sync here so this component knows when it's safe to unmount the splash for good. */
const EXIT_TRANSITION_MS = 300;

/**
 * Wraps the whole app shell (see App.tsx) with the branded boot splash, staying up until both the
 * one-time catalog-health probe and the initial auth restore have resolved — then fades out to
 * reveal the app, which has been mounting underneath the whole time (not gated behind the splash),
 * so there's no separate "now build the page" delay once it's gone.
 *
 * A genuinely broken catalog (empty/offline after retries) still gets its own actionable full-
 * screen state below, same as before — that's unrelated to and unaffected by the splash timing.
 */
export function CatalogHealthGate({ children }: { children: ReactNode }) {
  const { status, retry, isEmulator } = useCatalogHealth();
  const { isLoading: authLoading } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [splashMounted, setSplashMounted] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!authLoading) return;
    const t = setTimeout(() => setAuthTimedOut(true), AUTH_WAIT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [authLoading]);

  const isErrorState = status === 'empty' || status === 'offline';
  const waitingOnBoot = status === 'checking' || (authLoading && !authTimedOut) || !minTimeElapsed;
  const showSplash = !isErrorState && (waitingOnBoot || splashMounted);

  useEffect(() => {
    if (isErrorState || waitingOnBoot) {
      setSplashMounted(true);
      return;
    }
    if (!splashMounted) return;
    const t = setTimeout(() => setSplashMounted(false), EXIT_TRANSITION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the thing driving exit changes
  }, [waitingOnBoot, isErrorState]);

  if (isErrorState && !dismissed) {
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

  return (
    <>
      {children}
      {showSplash && <SplashScreen exiting={!waitingOnBoot} />}
    </>
  );
}

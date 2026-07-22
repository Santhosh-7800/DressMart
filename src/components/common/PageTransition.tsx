import { Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';

interface AnimatedOutletProps {
  /** Override the key AnimatePresence tracks — pass a stable constant to suppress
   *  transitions between routes that share a persistent parent layout (e.g. a sidebar). */
  transitionKey?: string;
}

function ContentFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary-300" size={28} />
    </div>
  );
}

export function AnimatedOutlet({ transitionKey }: AnimatedOutletProps) {
  const location = useLocation();
  const key = transitionKey ?? location.pathname;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Scoped so a routed page failing to render (e.g. a stale/failed lazy chunk) shows a
            visible error here, with header/nav/footer — outside this boundary — staying intact,
            instead of leaving the content area silently blank. Suspense is nested the same way
            so a slow chunk load only shows a spinner in the content area, not over the whole page. */}
        <ErrorBoundary>
          <Suspense fallback={<ContentFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </motion.div>
    </AnimatePresence>
  );
}

// Routes nested under AccountLayout (see AppRoutes.tsx) — collapsing them to one key keeps
// the sidebar from unmounting/re-fading every time the user switches between account pages;
// AccountLayout's own AnimatedOutlet (keyed by the full pathname) handles that inner transition.
const ACCOUNT_SECTION_PATHS = ['/profile', '/orders', '/addresses', '/saved-payments', '/notifications', '/coupons', '/settings', '/rewards', '/referrals'];

export function useOuterTransitionKey(): string {
  const location = useLocation();
  const isAccountSection = ACCOUNT_SECTION_PATHS.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  return isAccountSection ? 'account-section' : location.pathname;
}

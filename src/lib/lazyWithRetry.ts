import { lazy, type ComponentType } from 'react';

/**
 * Wraps React.lazy() with a retry-once-then-log approach for a failed dynamic import.
 *
 * React.lazy() permanently caches a REJECTED import promise: if a route's code-split chunk ever
 * fails to load once (e.g. a stale reference after a dev-server rebuild, or a new production
 * deploy renamed/removed a chunk a tab had cached), every later attempt to render that lazy
 * component re-throws the exact same cached rejection — with no error boundary scoped closely
 * enough to catch it, that surfaces as the routed page silently rendering nothing (header/nav still
 * render since they're outside the failing subtree, but the content area stays blank).
 *
 * This retries the import once immediately (a transient network blip resolves on its own), and if
 * that also fails, logs a clear, identifiable error and re-throws — letting it propagate to the
 * ErrorBoundary around <AnimatedOutlet> (see components/common/PageTransition.tsx), which renders a
 * visible "Something went wrong" fallback with a manual refresh button. Deliberately does NOT
 * auto-reload the page itself: a silent `window.location.reload()` is exactly the kind of surprise
 * navigation that makes a stale-chunk failure look like an unrelated routing bug, and only a
 * user-initiated refresh (a real button click, same as the ErrorBoundary's) is appropriate here.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(importer: () => Promise<{ default: T }>, chunkName?: string) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (firstError) {
      console.warn(`[lazyWithRetry] Chunk "${chunkName ?? 'unknown'}" failed to load, retrying once…`, firstError);
      try {
        return await importer();
      } catch (secondError) {
        console.error(
          `[lazyWithRetry] Chunk "${chunkName ?? 'unknown'}" failed to load after retry — this route will render the ErrorBoundary fallback instead of a blank page.`,
          secondError,
        );
        throw secondError;
      }
    }
  });
}

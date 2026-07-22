import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'dressmart:chunk-reload-attempted';

/**
 * Wraps React.lazy() with a one-time reload-and-retry for a failed dynamic import.
 *
 * React.lazy() permanently caches a REJECTED import promise: if a route's code-split chunk
 * ever fails to load once (e.g. the dev server hot-reloaded and invalidated the module graph
 * mid-session, or — in production — a new deploy renamed/removed the chunk a tab had cached),
 * every later attempt to render that lazy component re-throws the exact same cached rejection.
 * With no error boundary scoped closely enough to catch and retry it, that surfaces as the routed
 * page silently rendering nothing next time you navigate to it — header/nav still render (they're
 * outside the failing subtree), but the content area stays blank. A sessionStorage flag limits the
 * auto-reload to once per session, so a genuinely broken import still surfaces as a visible error
 * (via the ErrorBoundary around AnimatedOutlet) instead of reloading forever.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(importer: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const loaded = await importer();
      window.sessionStorage.removeItem(RELOAD_FLAG);
      return loaded;
    } catch (error) {
      if (!window.sessionStorage.getItem(RELOAD_FLAG)) {
        window.sessionStorage.setItem(RELOAD_FLAG, 'true');
        window.location.reload();
        // The reload takes over before this promise would otherwise need to settle.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}

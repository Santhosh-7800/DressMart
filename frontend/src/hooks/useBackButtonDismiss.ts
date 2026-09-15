import { useEffect, useRef } from 'react';

/**
 * Makes the Android/browser hardware Back button close an open overlay (modal, drawer, lightbox)
 * instead of navigating away from the page underneath it — the behavior every native Android app
 * gives you for free, and the one thing a web app has to build by hand. Call with the overlay's own
 * `isOpen` and `onClose`.
 *
 * Mechanism: pushes one throwaway history entry the moment the overlay opens. Back then just pops
 * that entry (a `popstate` event we're listening for) instead of the real previous page. If the
 * overlay instead closes some other way (X button, backdrop click, Escape, a submit handler), the
 * cleanup below consumes that same dangling entry itself via `history.back()` — otherwise the next
 * real Back press would silently get "eaten" by a no-op entry instead of actually leaving the page.
 * A ref (not state) tracks which side already happened so the two paths never double-fire each other.
 */
export function useBackButtonDismiss(isOpen: boolean, onClose: () => void): void {
  const consumedByPopRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    // A unique, serializable marker (Symbols aren't structured-cloneable, so pushState would throw)
    // identifying *this* dismissable entry — see the cleanup below for why.
    const marker = `dismissable-${Date.now()}-${Math.random()}`;
    window.history.pushState({ dismissable: true, marker }, '');
    consumedByPopRef.current = false;

    const handlePopState = () => {
      consumedByPopRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // A <Link> (or a signOut()-style redirect) inside the overlay can close it by navigating to a
      // real route, which pushes its own history entry on top of ours *before* this cleanup runs —
      // history.state no longer matches our marker in that case. Blindly calling history.back() here
      // would silently undo that fresh navigation (bouncing the user right back to where they
      // started) instead of just dismissing the overlay. Only pop when our marker is still the
      // current entry, i.e. nothing has navigated since the overlay opened.
      const current = window.history.state as { marker?: string } | null;
      if (!consumedByPopRef.current && current?.marker === marker) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}

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

    window.history.pushState({ dismissable: true }, '');
    consumedByPopRef.current = false;

    const handlePopState = () => {
      consumedByPopRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!consumedByPopRef.current) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}

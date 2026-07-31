import { useEffect, useState } from 'react';

/** Live connectivity state — unlike useCatalogHealth (a one-shot boot check), this keeps tracking
 *  `online`/`offline` events for the whole session, so the app can react if connectivity drops or
 *  returns mid-browse, not just at startup. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

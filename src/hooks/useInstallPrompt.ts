import { useCallback, useEffect, useState } from 'react';

/** Chrome fires this instead of its own mini-infobar when the page calls `preventDefault()` on it,
 *  handing control of exactly when/how to ask over to the site — no official DOM lib types for it. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/**
 * Wraps the `beforeinstallprompt` / `appinstalled` events behind a small imperative API —
 * `promptInstall()` — so a UI component (see InstallAppBanner) doesn't need to know about the
 * underlying event dance. `isInstallable` is only ever true on browsers that support this API
 * (Chromium-based; Safari has no equivalent) and only before the app is already installed.
 */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredEvent(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredEvent) return false;
    await deferredEvent.prompt();
    const choice = await deferredEvent.userChoice;
    setDeferredEvent(null);
    return choice.outcome === 'accepted';
  }, [deferredEvent]);

  return { isInstallable: Boolean(deferredEvent) && !isInstalled, isInstalled, promptInstall };
}

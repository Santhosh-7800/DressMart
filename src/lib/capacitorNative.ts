import { Capacitor } from '@capacitor/core';
import { DEEP_LINK_EVENT, resolveDeepLinkPath } from './deepLinks';
import { initPushNotifications } from './pushNotifications';

/**
 * Native-shell-only setup — everything here is a no-op on the web (Capacitor.isNativePlatform()
 * guards it), so it changes nothing about the existing browser/PWA experience. Four things a
 * WebView doesn't give an app for free the way a real native screen does:
 *
 * 1. Status bar color/style — left to its default, the status bar is the OS's generic
 *    light/white, clashing with DressMart's navy (#131921) header.
 * 2. The hardware Back button — Capacitor's WebView only replays browser history; with no history
 *    left (e.g. sitting on Home) the default behavior varies by version and can feel like Back
 *    "does nothing" instead of exiting, which is what every native Android app does at its root.
 * 3. Deep links (dressmart://...) — fire as a native `appUrlOpen` event outside the React tree
 *    entirely; re-dispatched as a DOM CustomEvent so `DeepLinkListener` (mounted inside
 *    <BrowserRouter>, see AppRoutes.tsx) can turn it into a real client-side navigation.
 * 4. Push notifications — see pushNotifications.ts's docstring: wired but inert until a real
 *    Firebase project's google-services.json is added.
 */
export async function initCapacitorNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const [{ StatusBar, Style }, { App: CapApp }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/app'),
  ]);

  await StatusBar.setBackgroundColor({ color: '#131921' }).catch(() => undefined);
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);

  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      CapApp.exitApp();
    }
  });

  CapApp.addListener('appUrlOpen', ({ url }) => {
    const path = resolveDeepLinkPath(url);
    if (path) window.dispatchEvent(new CustomEvent(DEEP_LINK_EVENT, { detail: path }));
  });

  void initPushNotifications();
}

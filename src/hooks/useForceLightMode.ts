import { useEffect } from 'react';

const THEME_STORAGE_KEY = 'dressmart:theme';

/**
 * Forces the light theme while mounted — the admin panel and Staff Portal have no dark mode ("No dark
 * sections" in the design spec) and must not inherit whatever the customer storefront's global
 * dark-mode preference happens to be. A MutationObserver (not just a one-time class removal) is
 * used because ThemeContext's own effect can run after this one on the very first render of a
 * direct/refreshed /admin URL (React fires child effects before parent effects), which would
 * otherwise re-add `dark` right after this hook removes it. The user's actual preference is read
 * straight from localStorage — not the live DOM class, which may not be synced yet — and restored
 * on unmount so leaving the admin panel is completely unaffected.
 */
export function useForceLightMode(): void {
  useEffect(() => {
    const root = window.document.documentElement;
    const preferredTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const enforceLight = () => root.classList.remove('dark');

    enforceLight();
    const observer = new MutationObserver(enforceLight);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      if (preferredTheme === 'dark') root.classList.add('dark');
    };
  }, []);
}

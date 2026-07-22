import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * BrowserRouter navigations (Link, NavLink, useNavigate, Back/Forward) never trigger a real page
 * load, so the window simply keeps whatever scrollY the previous route left it at — e.g. opening
 * a product from partway down the Home page left Product Details visually scrolled to that same
 * position instead of starting at the top. The browser's own scroll restoration only kicks in for
 * Back/Forward (not Link/useNavigate) and would fight this, so it's switched to 'manual' once and
 * every route change resets to the top itself instead — uniformly for every kind of navigation.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}

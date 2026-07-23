import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';

export function NotFoundPage() {
  const location = useLocation();

  // Logged so a stale bookmark/history entry pointing at a removed route (e.g. an old feature
  // that no longer exists) is identifiable in the console instead of just silently showing 404 —
  // useful when Back/Forward walks into a URL from before a route was removed.
  useEffect(() => {
    console.warn(`[NotFoundPage] No route matched "${location.pathname}${location.search}" — rendering 404 fallback.`);
  }, [location.pathname, location.search]);

  return (
    <div className="container-app flex min-h-[70vh] flex-col items-center justify-center text-center">
      <Seo title="Page Not Found" />
      <p className="text-8xl font-black text-primary-100 dark:text-primary-700">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-primary-400">The page you're looking for doesn't exist or may have been moved.</p>
      <Link to="/" className="btn-accent mt-6">
        Back to Home
      </Link>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';

export function NotFoundPage() {
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

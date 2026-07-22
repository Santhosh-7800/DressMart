import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Seo } from '@/components/common/Seo';

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center dark:bg-surface-dark">
      <Seo title="Access Denied" />
      <ShieldAlert size={56} className="text-red-500" />
      <p className="mt-4 text-6xl font-black text-primary-100 dark:text-primary-700">403</p>
      <h1 className="mt-2 text-2xl font-bold">Access Denied</h1>
      <p className="mt-2 max-w-sm text-sm text-primary-400">You don't have permission to view this page. This area is restricted to authorized staff.</p>
      <Link to="/" className="btn-accent mt-6">
        Back to Home
      </Link>
    </div>
  );
}

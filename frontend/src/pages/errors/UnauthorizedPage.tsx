import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { useAuth } from '@/contexts/AuthContext';

/** Reached when a signed-in user's role doesn't permit the route they tried to open (e.g. a buyer
 *  hitting /seller/dashboard, or a seller hitting a Head-Seller-only page) — see
 *  RequireSeller/RequireStaff/RequireHeadSeller. Mirrors NotFoundPage's exact layout/style. */
export function UnauthorizedPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="container-app flex min-h-[70vh] flex-col items-center justify-center text-center">
      <Seo title="Access Denied" />
      <p className="text-8xl font-black text-primary-100 dark:text-primary-700">403</p>
      <h1 className="mt-2 text-2xl font-bold">You don't have permission to view this page</h1>
      <p className="mt-2 max-w-sm text-sm text-primary-400">Your account role doesn't allow access to this section.</p>
      <Link to={isAuthenticated ? '/' : '/login'} className="btn-accent mt-6">
        {isAuthenticated ? 'Back to Home' : 'Back to Login'}
      </Link>
    </div>
  );
}

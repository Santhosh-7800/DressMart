import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage';
import type { UserRole } from '@/types';

interface RequireRoleProps {
  roles: UserRole[];
}

/**
 * Gate for the Admin Panel. Unauthenticated visitors go to /login (same as ProtectedRoute); a
 * signed-in customer (or any role not in `roles`) hitting /admin gets a 403 rendered right there
 * at that URL — never redirected elsewhere — so a customer can never discover backend routes
 * exist just by watching where they get bounced to. The Staff Portal (/staff/*) uses a different
 * gate, RequireStaffOnly, which redirects instead — see that file for why.
 */
export function RequireRole({ roles }: RequireRoleProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary-300" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!user || !roles.includes(user.role)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}

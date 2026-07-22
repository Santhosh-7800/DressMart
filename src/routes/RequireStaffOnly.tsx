import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isBackendRole } from '@/lib/roles';

/**
 * Gate for the Staff Portal (/staff/*). Unlike RequireRole (used by /admin, which shows a 403 at
 * the same URL for the wrong role), the Staff Portal spec calls for actual redirects: customers go
 * to "/", admins go to "/admin", and only role === 'staff' gets through — admin/shop_owner are
 * deliberately excluded here, they have their own separate panel and must never land on the Staff
 * Dashboard, which also never appears in the Admin sidebar.
 */
export function RequireStaffOnly() {
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
    return <Navigate to="/staff/login" state={{ from: location.pathname }} replace />;
  }

  if (user?.role === 'staff') {
    return <Outlet />;
  }

  if (isBackendRole(user?.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/" replace />;
}

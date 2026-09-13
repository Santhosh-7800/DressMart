import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isDeliveryRole } from '@/lib/roles';

/** Gate for the Delivery Dashboard (/delivery/*) — role must be 'delivery'. Mirrors RequireStaff.tsx. */
export function RequireDelivery() {
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
    return <Navigate to="/delivery/login" state={{ from: location.pathname }} replace />;
  }

  if (!isDeliveryRole(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

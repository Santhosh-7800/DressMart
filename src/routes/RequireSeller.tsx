import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isSellerRole } from '@/lib/roles';

/** Gate for the Seller Dashboard (/seller/*) — role must be 'seller' or 'head_seller'. */
export function RequireSeller() {
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
    return <Navigate to="/seller/login" state={{ from: location.pathname }} replace />;
  }

  if (!isSellerRole(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

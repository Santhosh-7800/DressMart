import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';

/** Gate for Head-Seller-only sub-routes inside the Seller Dashboard (analytics, seller management, platform settings, coupons). */
export function RequireHeadSeller() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary-300" size={32} />
      </div>
    );
  }

  if (!isHeadSeller(user?.role)) {
    return <Navigate to="/seller/dashboard" replace />;
  }

  return <Outlet />;
}

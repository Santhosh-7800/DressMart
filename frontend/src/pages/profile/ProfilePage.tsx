import { useNavigate } from 'react-router-dom';
import { Clock3, ShieldAlert } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { InstallAppBanner } from '@/components/profile/InstallAppBanner';
import { ProfileMobileList } from '@/components/profile/ProfileMobileList';
import { ProfileDesktopDashboard } from './ProfileDesktopDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { avatarUrl } = useAvatar();
  // Real conditional MOUNT (not just CSS hidden) — the desktop dashboard's data hooks
  // (orders/wishlist/addresses/coupons/recommendations) only run at all when this is true, so
  // mobile doesn't pay for fetching/rendering a dashboard it never shows. See
  // ProfileDesktopDashboard's docstring.
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Seo title="My Account" />

      {/* Mobile: minimal vertical tap-through list (Amazon/Flipkart/Myntra pattern), linking out
          to the existing dedicated Orders/Wishlist/Addresses/Coupons/Settings/Help pages instead
          of repeating the desktop dashboard's previews inline. */}
      {!isDesktop && <ProfileMobileList user={user} avatarUrl={avatarUrl} onSignOut={handleSignOut} />}

      {/* Desktop/tablet: unchanged richer dashboard — see ProfileDesktopDashboard.tsx. */}
      {isDesktop && <ProfileDesktopDashboard user={user} onSignOut={handleSignOut} />}

      <InstallAppBanner />

      {(user.role === 'seller' || user.role === 'head_seller') && user.seller_status === 'pending' && (
        <div className="flex items-center gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <Clock3 size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Your seller application is under review</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">We'll notify you once the Head Seller approves your store, {user.store_name ?? 'your store'}.</p>
          </div>
        </div>
      )}

      {user.seller_status === 'suspended' && (
        <div className="flex items-center gap-3 rounded-[20px] border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/10">
          <ShieldAlert size={20} className="shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-red-800 dark:text-red-300">Your seller account has been suspended</p>
            {user.seller_status_reason && <p className="text-xs text-red-700/80 dark:text-red-400/80">{user.seller_status_reason}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

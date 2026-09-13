import { useNavigate } from 'react-router-dom';
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
    </div>
  );
}

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Package, MapPin, Bell, Ticket, Heart, Store, Settings, LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { Avatar } from '@/components/ui/Avatar';
import { AnimatedOutlet } from '@/components/common/PageTransition';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/profile', label: 'Profile', icon: User, end: true },
  { to: '/orders', label: 'My Orders', icon: Package },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/coupons', label: 'Coupons', icon: Ticket },
  { to: '/addresses', label: 'Addresses', icon: MapPin },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/sell', label: 'Sell on DressMart', icon: Store },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavItems({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    onNavigate?.();
    await signOut();
    navigate('/');
  };

  // Existing sellers manage their store from the Seller Dashboard, not this "apply to sell" link.
  const items = NAV_ITEMS.filter((item) => item.to !== '/sell' || user?.role === 'buyer');

  return (
    <>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-acc-primary text-white shadow-[0_10px_24px_-10px_rgba(255,107,0,0.7)]'
                : 'text-acc-text-secondary hover:bg-acc-primary/10 hover:text-acc-primary dark:text-primary-300 dark:hover:bg-primary-800',
            )
          }
        >
          <Icon size={18} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
          {!collapsed && <span className="truncate">{label}</span>}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={handleLogout}
        title={collapsed ? 'Logout' : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20',
          collapsed && 'justify-center px-0',
        )}
      >
        <LogOut size={18} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
        {!collapsed && <span className="truncate">Logout</span>}
      </button>
    </>
  );
}

/** Small avatar+name summary shown at the top of the account sidebar/drawer — so a profile photo
 *  update or name change is visible on every account page (Orders, Wishlist, Addresses, ...), not
 *  just the Profile page itself. */
function AccountSummary() {
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  if (!user) return null;

  return (
    <div className="mb-2 flex items-center gap-3 border-b border-acc-border px-1 pb-3 dark:border-primary-700">
      <Avatar src={avatarUrl} name={user.full_name} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{user.full_name}</p>
        <p className="truncate text-xs text-acc-text-secondary">{user.email}</p>
      </div>
    </div>
  );
}

/**
 * Shared shell for every "My Account" page — a centered 1200px container with a 260px desktop
 * sidebar (icon rail on tablet, bottom-sheet drawer on mobile) and a fluid content column, so
 * every account page (Profile, Orders, Addresses, ...) gets the same premium chrome for free.
 */
export function AccountLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();

  return (
    <div className="min-h-screen bg-acc-bg dark:bg-surface-dark">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Desktop: full labeled sidebar, 260px */}
          <aside className="hidden shrink-0 lg:block lg:w-[260px]">
            <nav className="sticky top-24 flex flex-col gap-1.5 rounded-[20px] border border-acc-border bg-white p-3 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
              <AccountSummary />
              <NavItems />
            </nav>
          </aside>

          {/* Tablet: collapsed icon-only rail */}
          <aside className="hidden shrink-0 md:block md:w-[76px] lg:hidden">
            <nav className="sticky top-24 flex flex-col items-center gap-1.5 rounded-[20px] border border-acc-border bg-white p-2 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
              {user && <Avatar src={avatarUrl} name={user.full_name} size="sm" className="mb-1" />}
              <NavItems collapsed />
            </nav>
          </aside>

          {/* Content — always centered within the 1200px shell, fluid width */}
          <div className="min-w-0 flex-1 pb-24 md:pb-0">
            <AnimatedOutlet />
          </div>
        </div>
      </div>

      {/* Mobile: bottom bar that opens a drawer */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-acc-border bg-white/95 px-4 py-3 backdrop-blur-md md:hidden dark:border-primary-700 dark:bg-card-dark/95">
        <div>
          <p className="text-xs text-acc-text-secondary">My Account</p>
          <p className="text-sm font-semibold text-acc-text dark:text-white">Menu</p>
        </div>
        <button
          onClick={() => setIsMobileNavOpen(true)}
          className="flex items-center gap-2 rounded-full bg-acc-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,107,0,0.7)] transition-transform active:scale-95"
        >
          <Menu size={16} /> Account Menu
        </button>
      </div>

      {/* Mobile: bottom-sheet drawer nav */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-primary-950/50 md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-[24px] bg-white p-4 shadow-popover md:hidden dark:bg-card-dark"
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-primary-200 dark:bg-primary-700" />
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-acc-text dark:text-white">My Account</h2>
                <button onClick={() => setIsMobileNavOpen(false)} className="rounded-full p-1.5 hover:bg-primary-100 dark:hover:bg-primary-800" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              <AccountSummary />
              <nav className="flex flex-col gap-1.5">
                <NavItems onNavigate={() => setIsMobileNavOpen(false)} />
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

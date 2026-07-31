import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  ShoppingBag,
  RotateCcw,
  Repeat,
  Settings,
  Users,
  BarChart3,
  FileBarChart,
  Ticket,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  Store,
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  Bell,
  FolderTree,
  Image,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { useBackButtonDismiss } from '@/hooks/useBackButtonDismiss';
import { useRipple } from '@/hooks/useRipple';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { RippleLayer } from '@/components/ui/RippleLayer';
import { AnimatedOutlet } from '@/components/common/PageTransition';
import { isHeadSeller } from '@/lib/roles';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

function SellerTabLink({ to, label, icon: Icon, end }: NavItem) {
  const { ripples, addRipple, clearRipple } = useRipple();

  return (
    <NavLink
      to={to}
      end={end}
      onClick={addRipple}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden py-2 text-[11px] font-medium transition-colors active:scale-95',
          isActive ? 'text-acc-primary' : 'text-acc-text-secondary',
        )
      }
    >
      <RippleLayer ripples={ripples} onDone={clearRipple} />
      <Icon size={20} strokeWidth={2.25} />
      {label}
    </NavLink>
  );
}

/** The 4 highest-frequency destinations, shown as direct tabs on the mobile bottom bar — everything
 *  else (including all Head Seller-only items) stays reachable via the "More" tab's drawer. */
const SELLER_TABS: NavItem[] = [
  { to: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/seller/products', label: 'Products', icon: Package },
  { to: '/seller/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/seller/inventory', label: 'Inventory', icon: Boxes },
];

const BASE_NAV_ITEMS: NavItem[] = [
  { to: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/seller/products', label: 'Products', icon: Package },
  { to: '/seller/inventory', label: 'Inventory', icon: Boxes },
  { to: '/seller/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/seller/returns', label: 'Returns', icon: RotateCcw },
  { to: '/seller/exchanges', label: 'Exchanges', icon: Repeat },
  { to: '/seller/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/seller/notifications', label: 'Notifications', icon: Bell },
  { to: '/seller/settings', label: 'Profile & Settings', icon: Settings },
];

const HEAD_SELLER_NAV_ITEMS: NavItem[] = [
  { to: '/seller/sellers', label: 'Seller Management', icon: Users },
  { to: '/seller/all-products', label: 'All Products', icon: Layers },
  { to: '/seller/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/seller/reports', label: 'Revenue Reports', icon: FileBarChart },
  { to: '/seller/coupons', label: 'Coupons', icon: Ticket },
  { to: '/seller/categories', label: 'Categories', icon: FolderTree },
  { to: '/seller/banners', label: 'Banner Management', icon: Image },
  { to: '/seller/platform-settings', label: 'Platform Settings', icon: SlidersHorizontal },
];

function NavItems({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const items = isHeadSeller(user?.role) ? [...BASE_NAV_ITEMS, ...HEAD_SELLER_NAV_ITEMS] : BASE_NAV_ITEMS;

  const handleLogout = async () => {
    onNavigate?.();
    await signOut();
    navigate('/');
  };

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

function SellerSummary() {
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  if (!user) return null;

  return (
    <div className="mb-2 flex items-center gap-3 border-b border-acc-border px-1 pb-3 dark:border-primary-700">
      <Avatar src={avatarUrl} name={user.full_name} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{user.store_name || user.full_name}</p>
        <p className="truncate text-xs text-acc-text-secondary">{isHeadSeller(user.role) ? 'Head Seller' : 'Seller'}</p>
      </div>
    </div>
  );
}

/** Persistent banner shown on every seller page while `seller_status` is 'pending' review. */
function PendingApprovalBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <p>
        Your seller account is <span className="font-semibold">pending Head Seller approval</span> — your products won't be visible to
        buyers until approved.
      </p>
    </div>
  );
}

/** Full-page takeover for a suspended seller — no dashboard content or nav, just the reason and a way to sign out. */
function SuspendedBlock({ reason }: { reason: string | null | undefined }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-acc-bg px-4 dark:bg-surface-dark">
      <div className="w-full max-w-md rounded-[20px] border border-red-200 bg-white p-8 text-center shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-red-900/40 dark:bg-card-dark">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
          <ShieldAlert size={26} className="text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-acc-text dark:text-white">Your seller account is suspended</h1>
        <p className="mt-2 text-sm text-acc-text-secondary">
          {reason || 'Contact the Head Seller for more details.'}
        </p>
        <Button
          variant="outline"
          fullWidth
          className="mt-6"
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

/**
 * Shared shell for every Seller Dashboard page (regular seller and Head Seller alike — the Head
 * Seller is just a seller with extra nav items, per the product spec: one dashboard, no separate
 * admin app). Mirrors AccountLayout's visual conventions (rounded-2xl nav, acc-primary accent,
 * mobile bottom-sheet drawer) so it reads as part of the same app.
 */
export function SellerLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  useBackButtonDismiss(isMobileNavOpen, () => setIsMobileNavOpen(false));
  const { ripples: moreRipples, addRipple: addMoreRipple, clearRipple: clearMoreRipple } = useRipple();

  if (user?.seller_status === 'suspended') {
    return <SuspendedBlock reason={user.seller_status_reason} />;
  }

  return (
    <div className="min-h-screen bg-acc-bg dark:bg-surface-dark">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Desktop: full labeled sidebar, 260px */}
          <aside className="hidden shrink-0 lg:block lg:w-[260px]">
            <nav className="sticky top-24 flex flex-col gap-1.5 rounded-[20px] border border-acc-border bg-white p-3 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
              <div className="mb-1 flex items-center gap-2 px-1 pb-2">
                <Store size={16} className="text-acc-primary" />
                <span className="text-xs font-bold uppercase tracking-wide text-acc-text-secondary">Seller Dashboard</span>
              </div>
              <SellerSummary />
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
            {user?.seller_status === 'pending' && <PendingApprovalBanner />}
            <AnimatedOutlet />
          </div>
        </div>
      </div>

      {/* Mobile: persistent bottom tab bar for the 4 highest-frequency destinations (mirrors the
          buyer app's BottomNavBar), plus a "More" tab opening the same full-destination drawer
          below — the seller nav has too many items (up to 17 for a Head Seller) to fit as direct
          tabs, so "More" is the catch-all rather than a duplicate nav list. */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-acc-border bg-white/95 backdrop-blur-md md:hidden dark:border-primary-700 dark:bg-card-dark/95" aria-label="Seller">
        {SELLER_TABS.map((tab) => (
          <SellerTabLink key={tab.to} {...tab} />
        ))}
        <button
          onClick={(e) => {
            addMoreRipple(e);
            setIsMobileNavOpen(true);
          }}
          className="relative flex flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden py-2 text-[11px] font-medium text-acc-text-secondary transition-colors active:scale-95"
        >
          <RippleLayer ripples={moreRipples} onDone={clearMoreRipple} />
          <Menu size={20} strokeWidth={2.25} />
          More
        </button>
      </nav>

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
                <h2 className="text-base font-bold text-acc-text dark:text-white">Seller Dashboard</h2>
                <button onClick={() => setIsMobileNavOpen(false)} className="rounded-full p-1.5 hover:bg-primary-100 dark:hover:bg-primary-800" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              <SellerSummary />
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

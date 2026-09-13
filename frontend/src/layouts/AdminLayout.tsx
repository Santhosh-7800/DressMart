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
  Contact,
  UserCog,
  BarChart3,
  FileBarChart,
  PieChart,
  Ticket,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  Store,
  MessageSquare,
  Bell,
  FolderTree,
  Tags,
  Image,
  Truck,
  LifeBuoy,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { useBackButtonDismiss } from '@/hooks/useBackButtonDismiss';
import { useRipple } from '@/hooks/useRipple';
import { useNotifications } from '@/hooks/useNotifications';
import { useUnreadSupportCount } from '@/hooks/useSupportAdmin';
import { Avatar } from '@/components/ui/Avatar';
import { RippleLayer } from '@/components/ui/RippleLayer';
import { CountBadge } from '@/components/ui/CountBadge';
import { AnimatedOutlet } from '@/components/common/PageTransition';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

function AdminTabLink({ to, label, icon: Icon, end }: NavItem) {
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
 *  else stays reachable via the "More" tab's drawer. */
const ADMIN_TABS: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/returns', label: 'Returns', icon: RotateCcw },
  { to: '/admin/exchanges', label: 'Exchanges', icon: Repeat },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/settings', label: 'Profile & Settings', icon: Settings },
  { to: '/admin/customers', label: 'Customers', icon: Contact },
  { to: '/admin/staff', label: 'Staff Management', icon: UserCog },
  { to: '/admin/delivery', label: 'Delivery Management', icon: Truck },
  { to: '/admin/support', label: 'Customer Support', icon: LifeBuoy },
  { to: '/admin/faq', label: 'FAQ Management', icon: HelpCircle },
  { to: '/admin/all-products', label: 'All Products', icon: Layers },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/reports', label: 'Revenue Reports', icon: FileBarChart },
  { to: '/admin/business-reports', label: 'Business Reports', icon: PieChart },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/brands', label: 'Brands', icon: Tags },
  { to: '/admin/banners', label: 'Banner Management', icon: Image },
  { to: '/admin/platform-settings', label: 'Platform Settings', icon: SlidersHorizontal },
];

/** Live unread-count pill on the Notifications nav item — realtime (see useNotifications), so it
 *  updates the instant a new notification lands without needing to open the page. */
function NotificationNavBadge() {
  const { unreadCount } = useNotifications();
  return <CountBadge count={unreadCount} />;
}

/** Live unread-count pill on the Customer Support nav item — mirrors NotificationNavBadge above. */
function SupportNavBadge() {
  const unreadCount = useUnreadSupportCount();
  return <CountBadge count={unreadCount} />;
}

function NavItems({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    onNavigate?.();
    await signOut();
    navigate('/');
  };

  return (
    <>
      {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
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
          {to === '/admin/notifications' && <NotificationNavBadge />}
          {to === '/admin/support' && <SupportNavBadge />}
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

function AdminSummary() {
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  if (!user) return null;

  return (
    <div className="mb-2 flex items-center gap-3 border-b border-acc-border px-1 pb-3 dark:border-primary-700">
      <Avatar src={avatarUrl} name={user.full_name} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{user.store_name || user.full_name}</p>
        <p className="truncate text-xs text-acc-text-secondary">Admin</p>
      </div>
    </div>
  );
}

/**
 * Shared shell for every Admin Dashboard page. Mirrors AccountLayout's visual conventions
 * (rounded-2xl nav, acc-primary accent, mobile bottom-sheet drawer) so it reads as part of the
 * same app.
 */
export function AdminLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  useBackButtonDismiss(isMobileNavOpen, () => setIsMobileNavOpen(false));
  const { ripples: moreRipples, addRipple: addMoreRipple, clearRipple: clearMoreRipple } = useRipple();

  return (
    <div className="min-h-screen bg-acc-bg dark:bg-surface-dark md:h-screen md:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1200px] gap-6 px-4 sm:px-6 lg:px-8 md:h-screen">
        {/* Desktop: full labeled sidebar, 260px. The outer shell above is height-locked to the
            viewport on md+ (md:h-screen md:overflow-hidden) and this aside stretches to match it
            (flex's default align-items:stretch), then scrolls independently via its own
            overflow-y-auto — that's what actually keeps the sidebar in place while only the content
            pane scrolls. The previous `position:sticky` on the aside let the whole page (sidebar
            included) scroll together as one unit instead, which was the "both panels move" bug. */}
        <aside className="scrollbar-thin hidden shrink-0 overflow-y-auto px-1 py-8 lg:block lg:w-[260px]">
          <nav className="flex flex-col gap-1.5 rounded-[20px] border border-acc-border bg-white p-3 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
            <div className="mb-1 flex items-center gap-2 px-1 pb-2">
              <Store size={16} className="text-acc-primary" />
              <span className="text-xs font-bold uppercase tracking-wide text-acc-text-secondary">Admin Dashboard</span>
            </div>
            <AdminSummary />
            <NavItems />
          </nav>
        </aside>

        {/* Tablet: collapsed icon-only rail — same independent-scroll pattern as desktop. */}
        <aside className="scrollbar-thin hidden shrink-0 overflow-y-auto px-1 py-8 md:block md:w-[76px] lg:hidden">
          <nav className="flex flex-col items-center gap-1.5 rounded-[20px] border border-acc-border bg-white p-2 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
            {user && <Avatar src={avatarUrl} name={user.full_name} size="sm" className="mb-1" />}
            <NavItems collapsed />
          </nav>
        </aside>

        {/* Content — its own independent scroll pane on md+ (see aside comment above). On mobile
            there's no sidebar at all (just the bottom tab bar), so this is simply the page and
            scrolls normally with the browser's single scrollbar. */}
        <div className="scrollbar-thin min-w-0 flex-1 overflow-visible pt-8 pb-24 md:overflow-y-auto md:pb-8">
          <AnimatedOutlet />
        </div>
      </div>

      {/* Mobile: persistent bottom tab bar for the 4 highest-frequency destinations (mirrors the
          buyer app's BottomNavBar), plus a "More" tab opening the same full-destination drawer
          below — the admin nav has too many items to fit as direct tabs, so "More" is the
          catch-all rather than a duplicate nav list. */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-acc-border bg-white/95 backdrop-blur-md md:hidden dark:border-primary-700 dark:bg-card-dark/95" aria-label="Admin">
        {ADMIN_TABS.map((tab) => (
          <AdminTabLink key={tab.to} {...tab} />
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
                <h2 className="text-base font-bold text-acc-text dark:text-white">Admin Dashboard</h2>
                <button onClick={() => setIsMobileNavOpen(false)} className="rounded-full p-1.5 hover:bg-primary-100 dark:hover:bg-primary-800" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              <AdminSummary />
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

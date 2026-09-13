import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, UserCog, LogOut, Menu, X, Truck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { useBackButtonDismiss } from '@/hooks/useBackButtonDismiss';
import { Avatar } from '@/components/ui/Avatar';
import { AnimatedOutlet } from '@/components/common/PageTransition';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** The Delivery role is fulfillment-only — this fixed list IS the full scope of what a delivery
 *  account can reach (no Products/Inventory/Orders-in-general/Owner data). Mirrors StaffLayout.tsx. */
const DELIVERY_NAV_ITEMS: NavItem[] = [
  { to: '/delivery/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/delivery/profile', label: 'Profile', icon: UserCog },
];

function NavItems({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

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

function DeliverySummary() {
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  if (!user) return null;

  return (
    <div className="mb-2 flex items-center gap-3 border-b border-acc-border px-1 pb-3 dark:border-primary-700">
      <Avatar src={avatarUrl} name={user.full_name} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{user.full_name}</p>
        <p className="truncate text-xs text-acc-text-secondary">Delivery Staff</p>
      </div>
    </div>
  );
}

/** Shared shell for every Delivery Dashboard page — mirrors StaffLayout.tsx exactly, with its own
 *  fixed, fulfillment-only nav. No SuspendedBlock/DisabledBlock: an inactive delivery account is
 *  simply blocked from new assignment server-side (see assignDelivery.ts) rather than locked out of
 *  the dashboard entirely — they may still need to finish an in-progress delivery. */
export function DeliveryLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  useBackButtonDismiss(isMobileNavOpen, () => setIsMobileNavOpen(false));
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  const items = DELIVERY_NAV_ITEMS;

  return (
    <div className="min-h-screen bg-acc-bg dark:bg-surface-dark">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          <aside className="hidden shrink-0 lg:block lg:w-[260px]">
            <nav className="sticky top-24 flex flex-col gap-1.5 rounded-[20px] border border-acc-border bg-white p-3 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
              <div className="mb-1 flex items-center gap-2 px-1 pb-2">
                <Truck size={16} className="text-acc-primary" />
                <span className="text-xs font-bold uppercase tracking-wide text-acc-text-secondary">Delivery Dashboard</span>
              </div>
              <DeliverySummary />
              <NavItems items={items} />
            </nav>
          </aside>

          <aside className="hidden shrink-0 md:block md:w-[76px] lg:hidden">
            <nav className="sticky top-24 flex flex-col items-center gap-1.5 rounded-[20px] border border-acc-border bg-white p-2 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
              {user && <Avatar src={avatarUrl} name={user.full_name} size="sm" className="mb-1" />}
              <NavItems items={items} collapsed />
            </nav>
          </aside>

          <div className="min-w-0 flex-1 pb-24 md:pb-0">
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <h1 className="text-lg font-bold text-acc-text dark:text-white">Delivery Dashboard</h1>
              <button
                onClick={() => setIsMobileNavOpen(true)}
                className="rounded-full border border-acc-border p-2 dark:border-primary-700"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
            </div>
            <AnimatedOutlet />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-primary-950/50 lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-[24px] bg-white p-4 shadow-popover lg:hidden dark:bg-card-dark"
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-primary-200 dark:bg-primary-700" />
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-acc-text dark:text-white">Delivery Dashboard</h2>
                <button onClick={() => setIsMobileNavOpen(false)} className="rounded-full p-1.5 hover:bg-primary-100 dark:hover:bg-primary-800" aria-label="Close menu">
                  <X size={18} />
                </button>
              </div>
              <DeliverySummary />
              <nav className="flex flex-col gap-1.5">
                <NavItems items={items} onNavigate={() => setIsMobileNavOpen(false)} />
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

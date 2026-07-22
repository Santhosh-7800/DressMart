import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, Package, Boxes, User, Settings, LogOut, Menu, X, Store, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { staffService } from '@/services/staffService';

/** Everything the Staff Portal sidebar links to — deliberately excludes Orders, Customers,
 *  Reports, Coupons, Analytics, Returns, Categories, and Staff Management, all of which stay
 *  Admin-only. See RequireStaffOnly for the route-level enforcement of this same boundary. */
const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/products', label: 'Products', icon: Package },
  { to: '/staff/inventory', label: 'Inventory', icon: Boxes },
  { to: '/staff/profile', label: 'My Profile', icon: User },
  { to: '/staff/settings', label: 'Settings', icon: Settings },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    onNavigate?.();
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-6">
        <span className="text-lg font-bold tracking-tight text-white">
          Dress<span className="text-admin-orange">Mart</span>
        </span>
        <span className="rounded-md bg-gradient-to-br from-admin-orange-light to-admin-orange px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          Staff
        </span>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'rounded-[14px] bg-gradient-to-br from-admin-orange-light to-admin-orange text-white shadow-[0_10px_25px_rgba(255,107,0,0.35)]'
                  : 'rounded-2xl text-admin-text-inactive hover:translate-x-0.5 hover:bg-admin-orange/15 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={cn('shrink-0 transition-transform duration-200 group-hover:scale-110', !isActive && 'text-admin-icon-inactive group-hover:text-admin-orange-light')} />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1.5 border-t border-white/10 px-3 py-4">
        <Link
          to="/"
          onClick={onNavigate}
          className="group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-admin-text-inactive transition-all duration-200 hover:translate-x-0.5 hover:bg-admin-orange/15 hover:text-white"
        >
          <Store size={17} className="shrink-0 text-admin-icon-inactive transition-transform duration-200 group-hover:scale-110 group-hover:text-admin-orange-light" /> View Store
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl border border-red-500 px-3.5 py-2.5 text-left text-sm font-medium text-red-500 transition-all duration-200 hover:bg-red-600 hover:text-white"
        >
          <LogOut size={17} className="shrink-0" /> Logout
        </button>
      </div>
    </div>
  );
}

export function StaffLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { setTheme } = useTheme();

  // On login/mount: Supabase's stored theme wins if present (so a staff member's preference
  // follows them to a new device/browser); otherwise ThemeContext's own localStorage/system-
  // preference fallback (already applied before this effect runs) is left alone.
  const staffId = user?.id;
  useEffect(() => {
    if (!staffId) return;
    staffService.getDetails(staffId).then((details) => {
      if (details?.theme) setTheme(details.theme);
    });
  }, [staffId, setTheme]);

  return (
    <div className="admin-panel min-h-screen bg-admin-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-admin-navy shadow-popover lg:block">
        <SidebarNav />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-admin-navy px-4 py-3.5 text-white shadow-md lg:hidden">
        <button onClick={() => setIsMobileNavOpen(true)} aria-label="Open staff menu" className="rounded-lg p-1 transition-transform duration-200 active:scale-90">
          <Menu size={22} />
        </button>
        <span className="text-base font-bold">
          Dress<span className="text-admin-orange">Mart</span> Staff
        </span>
        <span className="w-[22px]" />
      </div>

      {/* Mobile drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50 transition-opacity duration-200" onClick={() => setIsMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] bg-admin-navy shadow-popover">
            <button
              onClick={() => setIsMobileNavOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1 text-white/70 transition-colors hover:text-white"
              aria-label="Close staff menu"
            >
              <X size={20} />
            </button>
            <SidebarNav onNavigate={() => setIsMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <div className="hidden items-center justify-between border-b border-admin-border bg-white px-6 py-4 shadow-[0_1px_0_rgba(17,24,39,0.02)] dark:border-slate-600 dark:bg-slate-800 lg:flex">
          <p className="text-sm font-medium text-admin-text-secondary">Staff Panel</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-admin-text">{user?.full_name}</span>
            <span className="rounded-full bg-gradient-to-br from-admin-orange-light to-admin-orange px-2.5 py-1 text-xs font-medium capitalize text-white shadow-sm">Staff</span>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-admin-orange-light to-admin-orange text-sm font-bold text-white shadow-sm">
              {user?.full_name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <main className="p-4 sm:p-6 lg:p-8">
          <div key={location.pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

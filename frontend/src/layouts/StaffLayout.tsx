import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Boxes, History, UserCog, LogOut, Briefcase, ShieldAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { AnimatedOutlet } from '@/components/common/PageTransition';
import { StaffBottomNavBar } from '@/components/staff/StaffBottomNavBar';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** The Staff role is product-management-only — this fixed list IS the full scope of what a staff
 *  account can reach (no Orders/Returns/Revenue/Admin-Management/Analytics/Payments). Individual
 *  add/edit/delete/manage_inventory/upload_images actions inside Products/Inventory still respect
 *  the account's granted StaffPermissionKeys (see AdminProductsPage's canAdd/canEdit/canDelete and
 *  AdminProductFormPage's isBlockedByStaffPermission/canUploadImages/canManageInventory gates) —
 *  this list only controls which destinations exist at all. */
const STAFF_NAV_ITEMS: NavItem[] = [
  { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/products', label: 'Products', icon: Package },
  { to: '/staff/inventory', label: 'Inventory', icon: Boxes },
  { to: '/staff/activity', label: 'My Activity', icon: History },
  { to: '/staff/settings', label: 'Profile', icon: UserCog },
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

function StaffSummary() {
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  if (!user) return null;

  return (
    <div className="mb-2 flex items-center gap-3 border-b border-acc-border px-1 pb-3 dark:border-primary-700">
      <Avatar src={avatarUrl} name={user.full_name} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{user.full_name}</p>
        <p className="truncate text-xs text-acc-text-secondary">{user.store_name ? `Staff · ${user.store_name}` : 'Staff'}</p>
      </div>
    </div>
  );
}

/** Full-page takeover for a disabled staff account — mirrors AdminLayout's equivalent block. */
function DisabledBlock({ reason }: { reason: string | null | undefined }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-acc-bg px-4 dark:bg-surface-dark">
      <div className="w-full max-w-md rounded-[20px] border border-red-200 bg-white p-8 text-center shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-red-900/40 dark:bg-card-dark">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
          <ShieldAlert size={26} className="text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-acc-text dark:text-white">Your staff account is disabled</h1>
        <p className="mt-2 text-sm text-acc-text-secondary">{reason || 'Contact the Head Seller for more details.'}</p>
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

/** Shared shell for every Staff Dashboard page — deliberately separate from AdminLayout even
 *  though it reuses two admin pages under /staff/* (AdminProductsPage/AdminInventoryPage), since
 *  a staff member's nav is a fixed, product-management-only list rather than "everything an admin
 *  can do". */
export function StaffLayout() {
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  const items = STAFF_NAV_ITEMS;

  if (user?.staff_status === 'disabled') {
    return <DisabledBlock reason={user.staff_status_reason} />;
  }

  return (
    <div className="min-h-screen bg-acc-bg dark:bg-surface-dark">
      {/* Mobile-only identity strip — the persistent bottom tab bar below now owns navigation, so
          this header is just "who am I / whose store", the same job Header.tsx does for buyers. */}
      {user && (
        <div className="pt-safe flex items-center gap-3 border-b border-acc-border bg-white px-4 py-3 md:hidden dark:border-primary-700 dark:bg-card-dark">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-acc-text dark:text-white">Welcome, {user.full_name.split(' ')[0]}</p>
            <p className="truncate text-xs text-acc-text-secondary">{user.store_name ? `${user.store_name} • Staff` : 'Staff'}</p>
          </div>
          <NavLink to="/staff/settings" aria-label="Open profile">
            <Avatar src={avatarUrl} name={user.full_name} size="md" />
          </NavLink>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          <aside className="hidden shrink-0 lg:block lg:w-[260px]">
            <nav className="sticky top-24 flex flex-col gap-1.5 rounded-[20px] border border-acc-border bg-white p-3 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
              <div className="mb-1 flex items-center gap-2 px-1 pb-2">
                <Briefcase size={16} className="text-acc-primary" />
                <span className="text-xs font-bold uppercase tracking-wide text-acc-text-secondary">Staff Dashboard</span>
              </div>
              <StaffSummary />
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
            <AnimatedOutlet />
          </div>
        </div>
      </div>

      <StaffBottomNavBar />
    </div>
  );
}

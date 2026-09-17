import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Boxes, History, UserCog, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRipple } from '@/hooks/useRipple';
import { RippleLayer } from '@/components/ui/RippleLayer';

interface TabDef {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const TABS: TabDef[] = [
  { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/products', label: 'Products', icon: Package },
  { to: '/staff/inventory', label: 'Inventory', icon: Boxes },
  { to: '/staff/activity', label: 'Activity', icon: History },
  { to: '/staff/settings', label: 'Profile', icon: UserCog },
];

function TabLink({ to, label, icon: Icon, end }: TabDef) {
  const { ripples, addRipple, clearRipple } = useRipple();

  return (
    <NavLink
      to={to}
      end={end}
      onClick={addRipple}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 overflow-hidden py-2 text-[11px] font-medium transition-all duration-200 active:scale-95',
          isActive ? 'font-semibold text-acc-primary' : 'text-acc-text-secondary hover:text-acc-text dark:hover:text-white',
        )
      }
    >
      <RippleLayer ripples={ripples} onDone={clearRipple} />
      <Icon size={20} strokeWidth={2.25} />
      <span>{label}</span>
    </NavLink>
  );
}

/** Persistent bottom tab bar for the Staff Dashboard — true phone widths only (md:hidden, matching
 *  StaffLayout's own breakpoint for when its collapsed icon-only sidebar takes over instead), mirrors
 *  the buyer app's BottomNavBar (same ripple/safe-area/active-state pattern) so Staff feels like a
 *  real section of the app rather than a shrunk desktop panel, but themed with the acc-* tokens
 *  already used throughout StaffLayout/StaffDashboardPage instead of the buyer's accent/primary. */
export function StaffBottomNavBar() {
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-acc-border bg-white/95 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden dark:border-primary-700 dark:bg-card-dark/95"
      aria-label="Staff navigation"
    >
      {TABS.map((tab) => (
        <TabLink key={tab.to} {...tab} />
      ))}
    </nav>
  );
}

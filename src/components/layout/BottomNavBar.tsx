import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingCart, Package, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import { useRipple } from '@/hooks/useRipple';
import { CountBadge } from '@/components/ui/CountBadge';
import { RippleLayer } from '@/components/ui/RippleLayer';

interface TabDef {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const TABS: TabDef[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/cart', label: 'Cart', icon: ShoppingCart },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/profile', label: 'Profile', icon: User },
];

function TabLink({ to, label, icon: Icon, end, badge }: TabDef & { badge?: number }) {
  const { ripples, addRipple, clearRipple } = useRipple();

  return (
    <NavLink
      to={to}
      end={end}
      onClick={addRipple}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 overflow-hidden py-2 text-[11px] font-medium transition-all duration-200 active:scale-95',
          isActive
            ? 'text-accent font-semibold'
            : 'text-primary-400 dark:text-primary-300 hover:text-primary-600 dark:hover:text-white',
        )
      }
    >
      <RippleLayer ripples={ripples} onDone={clearRipple} />
      <span className="relative">
        <Icon size={20} strokeWidth={2.25} />
        {badge !== undefined && <CountBadge count={badge} />}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

/**
 * Persistent bottom tab bar for the primary buyer shopping flow — mobile only (md:hidden), hidden
 * entirely on /checkout, and never rendered at all on Seller/Head-Seller (SellerLayout), Login/
 * Signup (AuthLayout) routes since those use a different layout that doesn't mount this component.
 * See src/layouts/MainLayout.tsx for where this is conditionally rendered.
 */
export function BottomNavBar() {
  const { totalItems } = useCart();

  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-primary-100 bg-white/95 backdrop-blur-md md:hidden dark:border-primary-700 dark:bg-card-dark/95 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
      aria-label="Primary"
    >
      {TABS.map((tab) => (
        <TabLink key={tab.to} {...tab} badge={tab.to === '/cart' ? totalItems : undefined} />
      ))}
    </nav>
  );
}

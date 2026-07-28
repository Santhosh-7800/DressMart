import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingCart, Package, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import { CountBadge } from '@/components/ui/CountBadge';

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
      className="pb-safe fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-primary-100 bg-white/95 backdrop-blur-md md:hidden dark:border-primary-700 dark:bg-card-dark/95"
      aria-label="Primary"
    >
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors active:scale-95',
              isActive ? 'text-accent' : 'text-primary-400 dark:text-primary-300',
            )
          }
        >
          <span className="relative">
            <Icon size={22} strokeWidth={2.25} />
            {to === '/cart' && <CountBadge count={totalItems} />}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

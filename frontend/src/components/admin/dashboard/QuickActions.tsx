import { Link } from 'react-router-dom';
import { Plus, Package, UserCog, ShoppingBag, Boxes, Ticket, Zap, MessageSquare, FileBarChart, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { isAdminRole } from '@/lib/roles';
import type { UserRole } from '@/types';

interface QuickAction {
  to: string;
  label: string;
  icon: LucideIcon;
  headSellerOnly?: boolean;
}

const ACTIONS: QuickAction[] = [
  { to: '/admin/products/new', label: 'Add Product', icon: Plus },
  { to: '/admin/products', label: 'Manage Products', icon: Package },
  { to: '/admin/staff', label: 'Manage Staff', icon: UserCog, headSellerOnly: true },
  { to: '/admin/orders', label: 'View Orders', icon: ShoppingBag },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket, headSellerOnly: true },
  { to: '/admin/products?dealsOnly=1', label: 'Flash Sales', icon: Zap },
  { to: '/admin/reviews', label: 'Customer Support', icon: MessageSquare },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart, headSellerOnly: true },
];

export function QuickActions({ role }: { role: UserRole | undefined }) {
  const headSeller = isAdminRole(role);
  const actions = ACTIONS.filter((a) => !a.headSellerOnly || headSeller);

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {actions.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <Icon size={22} />
              </div>
              <span className="text-xs font-medium text-acc-text dark:text-white">{label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

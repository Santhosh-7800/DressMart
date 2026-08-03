import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, UserCog, ShoppingBag, Bell, Search } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { useNotifications } from '@/hooks/useNotifications';
import { isHeadSeller } from '@/lib/roles';
import { formatDateTime } from '@/lib/utils';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Live clock — re-renders once a minute, not every second (a dashboard header doesn't need
 *  second-level precision and a per-second re-render would be wasteful). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function DashboardHeader() {
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const now = useNow();
  const [searchTerm, setSearchTerm] = useState('');
  const headSeller = isHeadSeller(user?.role);

  if (!user) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    const destination = headSeller ? '/seller/all-products' : '/seller/products';
    navigate(term ? `${destination}?q=${encodeURIComponent(term)}` : destination);
  };

  return (
    <div className="rounded-[20px] border border-acc-border bg-white p-5 shadow-[0_2px_16px_rgba(17,24,39,0.06)] dark:border-primary-700 dark:bg-card-dark">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Avatar src={avatarUrl} name={user.full_name} size="lg" />
            <span
              className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-card-dark"
              title="Online"
              aria-label="Online"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-acc-text dark:text-white sm:text-2xl">
              {greetingForHour(now.getHours())}, {user.full_name.split(' ')[0]}
            </h1>
            <p className="mt-0.5 truncate text-sm font-medium text-acc-primary">{user.store_name || (headSeller ? 'Head Seller' : 'Seller')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-acc-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Online
              </span>
              <span>{formatDateTime(now.toISOString())}</span>
              {user.last_login_at && <span>Last login: {formatDateTime(user.last_login_at)}</span>}
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative w-full lg:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acc-text-secondary" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products…"
            className="input-field pl-10"
          />
        </form>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-acc-border pt-4 dark:border-primary-700">
        <Button size="sm" variant="accent" onClick={() => navigate('/seller/products/new')}>
          <Plus size={15} /> Add Product
        </Button>
        {headSeller && (
          <Button size="sm" variant="outline" onClick={() => navigate('/seller/sellers')}>
            <Users size={15} /> Add Seller
          </Button>
        )}
        {headSeller && (
          <Button size="sm" variant="outline" onClick={() => navigate('/seller/staff')}>
            <UserCog size={15} /> Add Staff
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => navigate('/seller/orders')}>
          <ShoppingBag size={15} /> View Orders
        </Button>
        <Button size="sm" variant="outline" className="relative" onClick={() => navigate('/seller/notifications')}>
          <Bell size={15} /> Notifications
          {unreadCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

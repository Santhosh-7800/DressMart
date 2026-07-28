import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Menu, MapPin, ShoppingCart, Bell, User as UserIcon } from 'lucide-react';
import { SearchBar } from '@/components/common/SearchBar';
import { CategoryNav } from './CategoryNav';
import { MobileMenu } from './MobileMenu';
import { DeliveryDropdown } from './DeliveryDropdown';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { useWishlist } from '@/hooks/useWishlist';
import { useNotifications } from '@/hooks/useNotifications';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDefaultAddress } from '@/hooks/useDefaultAddress';
import { useAvatar } from '@/hooks/useAvatar';
import { CountBadge } from '@/components/ui/CountBadge';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
  const [isMobileDeliveryOpen, setIsMobileDeliveryOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const deliveryRef = useRef<HTMLDivElement>(null);
  const mobileDeliveryRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, signOut } = useAuth();
  const { totalItems } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { unreadCount } = useNotifications();
  const [pincode] = useLocalStorage('dressmart:pincode', '400001');
  // Keeps `pincode` above pinned to the user's actual default address (Addresses page, Checkout,
  // ...) — mounted here (always-rendered Header) so it stays in sync app-wide, not just when the
  // delivery dropdown happens to be open. See useDefaultAddress's docstring for the full mechanism.
  useDefaultAddress();
  const { avatarUrl } = useAvatar();

  useOnClickOutside(accountRef, () => setIsAccountOpen(false));
  useOnClickOutside(deliveryRef, () => setIsDeliveryOpen(false));
  useOnClickOutside(mobileDeliveryRef, () => setIsMobileDeliveryOpen(false));

  return (
    <header className="sticky top-0 z-40 bg-primary text-white shadow-md">
      {/* Mobile app-bar: hamburger + logo + delivery chip + notifications on one slim row, full-width
          search below — the desktop row's inline search/account/cart icons don't fit a phone width,
          and Cart/Profile are already reachable from the global BottomNavBar, so they're dropped here
          rather than squeezed in. */}
      <div className="container-app flex flex-col gap-2 py-2.5 md:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              Dress<span className="text-accent">Mart</span>
            </span>
          </Link>
          <div ref={mobileDeliveryRef} className="relative ml-auto shrink-0">
            <button
              onClick={() => setIsMobileDeliveryOpen((v) => !v)}
              className="flex items-center gap-1 text-xs"
              title="Delivery location"
              aria-label="Update delivery location"
            >
              <MapPin size={15} className="text-accent" />
              <span className="font-semibold">{pincode}</span>
            </button>
            {isMobileDeliveryOpen && <DeliveryDropdown onClose={() => setIsMobileDeliveryOpen(false)} />}
          </div>
          <Link to="/notifications" className="relative shrink-0" aria-label="Notifications">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-900">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
        <SearchBar />
      </div>

      {/* Tablet/desktop row — unchanged from before, just now gated to md+ since the block above
          takes over on phone widths. */}
      <div className="container-app hidden items-center gap-4 py-3 md:flex">
        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden" aria-label="Open menu">
          <Menu size={24} />
        </button>

        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="text-xl font-bold tracking-tight">
            Dress<span className="text-accent">Mart</span>
          </span>
        </Link>

        <div ref={deliveryRef} className="relative hidden shrink-0 md:block">
          <button
            onClick={() => setIsDeliveryOpen((v) => !v)}
            className="flex items-center gap-1 text-xs"
            title="Delivery location"
            aria-label="Update delivery location"
          >
            <MapPin size={16} className="text-accent" />
            <div className="text-left leading-tight">
              <p className="text-primary-200">Deliver to</p>
              <p className="font-semibold">{pincode}</p>
            </div>
          </button>
          {isDeliveryOpen && <DeliveryDropdown onClose={() => setIsDeliveryOpen(false)} />}
        </div>

        <div className="flex-1">
          <SearchBar />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <Link to="/notifications" className="relative hidden md:block" aria-label="Notifications">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-900">
                {unreadCount}
              </span>
            )}
          </Link>

          <Link to="/wishlist" className="relative hidden sm:block" aria-label="Wishlist">
            <Heart size={20} />
            {wishlistItems.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-900">
                {wishlistItems.length}
              </span>
            )}
          </Link>

          <div ref={accountRef} className="relative">
            <button onClick={() => setIsAccountOpen((v) => !v)} className="flex items-center gap-2" aria-label="Account menu">
              {isAuthenticated && user ? <Avatar src={avatarUrl} name={user.full_name} size="sm" /> : <UserIcon size={20} />}
              <span className="hidden text-sm font-medium lg:block">{isAuthenticated ? user?.full_name.split(' ')[0] : 'Login'}</span>
            </button>
            {isAccountOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-card p-2 text-primary-900 shadow-popover dark:bg-card-dark dark:text-white">
                {isAuthenticated ? (
                  <>
                    <Link to="/profile" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      My Profile
                    </Link>
                    <Link to="/orders" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      My Orders
                    </Link>
                    <Link to="/wishlist" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      Wishlist
                    </Link>
                    <Link to="/addresses" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      Addresses
                    </Link>
                    <Link to="/coupons" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      Coupons
                    </Link>
                    <Link to="/settings" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      Settings
                    </Link>
                    {(user?.role === 'seller' || user?.role === 'head_seller') && (
                      <Link to="/seller/dashboard" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-primary-50 dark:hover:bg-primary-800">
                        Seller Dashboard
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        signOut();
                        setIsAccountOpen(false);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary-50 dark:hover:bg-primary-800">
                      Login
                    </Link>
                    <Link to="/signup" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      Create account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Link to="/cart" className="relative flex items-center gap-1.5" aria-label="Cart">
            <ShoppingCart size={20} />
            <CountBadge count={totalItems} />
            <span className="hidden text-sm font-medium lg:block">Cart</span>
          </Link>
        </div>
      </div>

      <div className="container-app">
        <CategoryNav />
      </div>

      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </header>
  );
}

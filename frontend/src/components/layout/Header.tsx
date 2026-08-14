import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart, Menu, MapPin, Bell, ArrowLeft, ShoppingCart, User as UserIcon } from 'lucide-react';
import { SearchBar } from '@/components/common/SearchBar';
import { CategoryNav } from './CategoryNav';
import { MobileMenu } from './MobileMenu';
import { DeliveryDropdown } from './DeliveryDropdown';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useWishlist } from '@/hooks/useWishlist';
import { useCart } from '@/hooks/useCart';
import { useNotifications } from '@/hooks/useNotifications';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useDefaultAddress } from '@/hooks/useDefaultAddress';
import { useAvatar } from '@/hooks/useAvatar';
import { getMobilePageTitle } from '@/lib/pageTitles';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
  const [isMobileDeliveryOpen, setIsMobileDeliveryOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const deliveryRef = useRef<HTMLDivElement>(null);
  const mobileDeliveryRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, signOut } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const { totalItems: cartItemCount } = useCart();
  const { unreadCount } = useNotifications();
  const [pincode] = useLocalStorage('dressmart:pincode', '400001');
  // Keeps `pincode` above pinned to the user's actual default address (Addresses page, Checkout,
  // ...) — mounted here (always-rendered Header) so it stays in sync app-wide, not just when the
  // delivery dropdown happens to be open. See useDefaultAddress's docstring for the full mechanism.
  useDefaultAddress();
  const { avatarUrl } = useAvatar();
  const location = useLocation();
  const navigate = useNavigate();
  const mobileTitle = getMobilePageTitle(location.pathname);

  useOnClickOutside(accountRef, () => setIsAccountOpen(false));
  useOnClickOutside(deliveryRef, () => setIsDeliveryOpen(false));
  useOnClickOutside(mobileDeliveryRef, () => setIsMobileDeliveryOpen(false));

  return (
    <header className="sticky top-0 z-40 bg-primary text-white shadow-md">
      {mobileTitle === null ? (
        /* Mobile app-bar: hamburger + logo + delivery chip + notifications on one slim row,
           full-width search below — shown only on Home/Categories/Search, where a shopper is
           browsing rather than drilled into a specific screen. The desktop row's inline
           search/account/cart icons don't fit a phone width, and Cart/Profile are already
           reachable from the global BottomNavBar, so they're dropped here rather than squeezed in. */
        <div className="container-app flex flex-col gap-2 py-2.5 md:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} aria-label="Open menu" className="relative tap-target-48">
              <Menu size={22} />
            </button>
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <span className="text-lg font-bold tracking-tight">
                Dress<span className="text-accent">Mart</span>
              </span>
            </Link>
            <Link to="/notifications" className="relative ml-auto shrink-0 tap-target-48" aria-label="Notifications">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-900">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
          <div ref={mobileDeliveryRef} className="relative flex items-center gap-1.5 border-t border-white/10 pt-1.5 text-xs">
            <button
              onClick={() => setIsMobileDeliveryOpen((v) => !v)}
              className="relative flex items-center gap-1.5 tap-target-48"
              title="Delivery location"
              aria-label="Update delivery location"
            >
              <MapPin size={15} className="text-accent" />
              <span className="text-primary-200">Deliver to</span>
              <span className="font-semibold">{pincode}</span>
            </button>
            {isMobileDeliveryOpen && <DeliveryDropdown onClose={() => setIsMobileDeliveryOpen(false)} />}
          </div>
          <SearchBar />
        </div>
      ) : (
        /* Contextual sub-page header: every other mobile screen (PDP, Cart, Orders, Settings, ...)
           gets a plain "← Back  Title" row instead — the native pattern every Android shopping app
           uses once you've drilled into a specific screen, rather than repeating the home search
           bar everywhere. navigate(-1) mirrors the hardware Back button rather than hardcoding a
           parent route, since where "back" leads legitimately differs by how the page was reached. */
        <div className="container-app flex items-center gap-3 py-3 md:hidden">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="relative shrink-0 rounded-full p-1 -ml-1 tap-target-48 active:bg-white/10">
            <ArrowLeft size={22} />
          </button>
          <h1 className="truncate text-base font-semibold">{mobileTitle}</h1>
        </div>
      )}

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

          <Link to="/cart" className="relative" aria-label="Cart">
            <ShoppingCart size={20} />
            {cartItemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-900">
                {cartItemCount}
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
                    <Link to="/payments" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      Payment Methods
                    </Link>
                    <Link to="/search-history" onClick={() => setIsAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-800">
                      Search History
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
        </div>
      </div>

      <div className="container-app">
        <CategoryNav />
      </div>

      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </header>
  );
}

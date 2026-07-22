import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Heart, Package, MapPin, Ticket, Bell, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/useProducts';
import { useAvatar } from '@/hooks/useAvatar';
import { Avatar } from '@/components/ui/Avatar';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCOUNT_LINKS = [
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/orders', label: 'My Orders', icon: Package },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/addresses', label: 'Addresses', icon: MapPin },
  { to: '/coupons', label: 'Coupons', icon: Ticket },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/help-center', label: 'Help Center', icon: HelpCircle },
];

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { isAuthenticated, user, signOut } = useAuth();
  const { data: menCategories } = useCategories('men');
  const { data: kidsCategories } = useCategories('kids');
  const { avatarUrl } = useAvatar();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-primary-950/50" onClick={onClose} />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-surface dark:bg-surface-dark"
          >
            <div className="flex items-center justify-between border-b border-primary-100 p-4 dark:border-primary-700">
              <div className="flex items-center gap-3">
                {isAuthenticated && user && <Avatar src={avatarUrl} name={user.full_name} size="md" />}
                <div>
                  <p className="font-semibold">{isAuthenticated ? user?.full_name : 'Welcome to DressMart'}</p>
                  {!isAuthenticated && (
                    <Link to="/login" onClick={onClose} className="text-sm text-accent-600">
                      Login / Sign up
                    </Link>
                  )}
                </div>
              </div>
              <button onClick={onClose} aria-label="Close menu">
                <X size={22} />
              </button>
            </div>

            <div className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-400">Men</p>
              <div className="mb-4 grid grid-cols-2 gap-1">
                {(menCategories ?? []).slice(0, 10).map((c) => (
                  <Link key={c.id} to={`/men/${c.slug}`} onClick={onClose} className="rounded-lg px-2 py-1.5 text-sm hover:bg-primary-100 dark:hover:bg-primary-800">
                    {c.name}
                  </Link>
                ))}
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-400">Kids</p>
              <div className="mb-4 grid grid-cols-2 gap-1">
                {(kidsCategories ?? []).slice(0, 10).map((c) => (
                  <Link key={c.id} to={`/kids/${c.slug}`} onClick={onClose} className="rounded-lg px-2 py-1.5 text-sm hover:bg-primary-100 dark:hover:bg-primary-800">
                    {c.name}
                  </Link>
                ))}
              </div>

              <div className="border-t border-primary-100 pt-4 dark:border-primary-700">
                {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} onClick={onClose} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-primary-100 dark:hover:bg-primary-800">
                    <Icon size={18} className="text-primary-400" />
                    {label}
                  </Link>
                ))}
                {isAuthenticated && (
                  <button
                    onClick={() => {
                      signOut();
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

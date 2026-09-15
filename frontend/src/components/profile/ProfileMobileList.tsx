import { useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Package, Heart, MapPin, Ticket, Settings, History, HelpCircle, LifeBuoy, LogOut, ChevronRight, Camera } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAvatar } from '@/hooks/useAvatar';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import type { Profile } from '@/types';

interface ProfileMobileListProps {
  user: Profile;
  avatarUrl: string | null;
  onSignOut: () => void;
}

const ROWS = [
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/addresses', label: 'Addresses', icon: MapPin },
  { to: '/coupons', label: 'Coupons', icon: Ticket },
  { to: '/search-history', label: 'Search History', icon: History },
  { to: '/support', label: 'Support', icon: LifeBuoy },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help-center', label: 'Help', icon: HelpCircle },
];

/** Mobile-only vertical tap-through Profile screen (Amazon/Flipkart/Myntra pattern) — the
 *  richer dashboard (order/wishlist previews, inline edit form, coupons/address cards) stays
 *  desktop-only in ProfilePage; this just links out to each of those existing dedicated pages. */
export function ProfileMobileList({ user, avatarUrl, onSignOut }: ProfileMobileListProps) {
  const { uploadAvatar, isUploading } = useAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (file: File) => {
    try {
      await uploadAvatar(file);
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Photo upload failed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl bg-card p-4 dark:bg-card-dark">
        <div className="relative shrink-0">
          <Avatar src={avatarUrl} name={user.full_name} size="lg" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="tap-target-48 absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-acc-primary text-white shadow-sm disabled:opacity-60 dark:border-card-dark"
            title="Change photo"
            aria-label="Add or change profile photo"
          >
            <Camera size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoChange(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-acc-text dark:text-white">{user.full_name}</p>
          <p className="truncate text-sm text-acc-text-secondary">{user.email}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-2 dark:bg-card-dark">
        {ROWS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex min-h-12 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-acc-primary/5">
            <Icon size={18} className="shrink-0 text-acc-text-secondary" />
            <span className="flex-1 text-sm font-medium text-acc-text dark:text-white">{label}</span>
            <ChevronRight size={16} className="shrink-0 text-acc-text-secondary" />
          </Link>
        ))}
        <button
          type="button"
          onClick={onSignOut}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <LogOut size={18} className="shrink-0 text-red-600 dark:text-red-400" />
          <span className="flex-1 text-sm font-medium text-red-600 dark:text-red-400">Logout</span>
        </button>
      </div>
    </div>
  );
}

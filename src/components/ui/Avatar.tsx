import { cn } from '@/lib/utils';

interface AvatarProps {
  /** The user's photo — null/undefined shows the orange initials circle instead. */
  src?: string | null;
  /** Used to derive the fallback initial, and for the image's alt text. */
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

/** The one place "profile photo, or an orange circle with the user's initial" is implemented — used
 *  by the Navbar, My Account sidebar, Profile page, Checkout, Wishlist, and Reviews so every one of
 *  those surfaces renders the same avatar, always in sync with `profiles.avatar_url`. */
export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : '?';

  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-bold text-primary-900', SIZE_CLASSES[size], className)}>
      {src ? <img src={src} alt={name} loading="lazy" className="h-full w-full object-cover" /> : initial}
    </div>
  );
}

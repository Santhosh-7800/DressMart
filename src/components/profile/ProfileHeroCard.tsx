import { motion } from 'framer-motion';
import { BadgeCheck, Gift, Wallet, Package, Heart } from 'lucide-react';
import type { Profile } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';

interface ProfileHeroCardProps {
  user: Profile;
  pointsBalance: number;
  walletValue: number;
  orderCount: number;
  wishlistCount: number;
}

/** Premium gradient profile header: avatar, verified badge, member-since, and the four key account stats. */
export function ProfileHeroCard({ user, pointsBalance, walletValue, orderCount, wishlistCount }: ProfileHeroCardProps) {
  const stats = [
    { icon: Gift, label: 'Reward Points', value: pointsBalance.toLocaleString('en-IN') },
    { icon: Wallet, label: 'Wallet Balance', value: formatCurrency(walletValue) },
    { icon: Package, label: 'Orders', value: orderCount.toLocaleString('en-IN') },
    { icon: Heart, label: 'Wishlist', value: wishlistCount.toLocaleString('en-IN') },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="overflow-hidden rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-6 text-white shadow-[0_20px_44px_-18px_rgba(255,107,0,0.5)] sm:p-8"
    >
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/30 bg-white/15 text-2xl font-bold backdrop-blur-sm sm:h-24 sm:w-24 sm:text-3xl">
          {user.avatar_url ? <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" /> : user.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{user.full_name}</h1>
            <BadgeCheck size={20} className="shrink-0 fill-white/25 text-white" aria-label="Verified account" />
          </div>
          <p className="truncate text-sm text-white/80">{user.email}</p>
          <p className="mt-1 text-xs text-white/70">Member since {formatDate(user.created_at)}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
            <Icon size={16} className="mb-1.5 opacity-80" />
            <p className="text-lg font-bold leading-tight">{value}</p>
            <p className="text-xs text-white/75">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

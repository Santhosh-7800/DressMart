import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Gift, Users, Ticket, MapPin, Sparkles, Package, Heart, Clock, Copy, Plus, Camera } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { ProductCard } from '@/components/product/ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { ProfileHeroCard } from '@/components/profile/ProfileHeroCard';
import { DashboardSection } from '@/components/profile/DashboardSection';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useAvatar } from '@/hooks/useAvatar';
import { useRewardsWallet } from '@/hooks/useRewards';
import { useOrders } from '@/hooks/useOrders';
import { useWishlist } from '@/hooks/useWishlist';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useAddresses } from '@/hooks/useAddresses';
import { useCoupons } from '@/hooks/useCoupons';
import { usePersonalizedRecommendations } from '@/hooks/usePersonalizedRecommendations';
import { calculateRedemptionValue } from '@/services/rewardsService';
import { formatCurrency, formatDate } from '@/lib/utils';

const ORDER_STATUS_STYLES: Record<string, string> = {
  placed: 'badge-accent',
  confirmed: 'badge-accent',
  packed: 'badge-accent',
  shipped: 'badge-accent',
  out_for_delivery: 'badge-accent',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
  returned: 'badge-danger',
};

export function ProfilePage() {
  const { user } = useAuth();
  const { updateProfile, isUpdating } = useProfile();
  const { avatarUrl, uploadAvatar, isUploading } = useAvatar();
  const { data: rewardsWallet } = useRewardsWallet();
  const { data: orders, isLoading: isLoadingOrders } = useOrders();
  const { items: wishlistItems, isLoading: isLoadingWishlist } = useWishlist();
  const { recentlyViewed, isLoading: isLoadingRecent } = useRecentlyViewed();
  const { addresses, isLoading: isLoadingAddresses } = useAddresses();
  const { data: coupons, isLoading: isLoadingCoupons } = useCoupons();
  const { recommendations, isLoading: isLoadingRecommendations } = usePersonalizedRecommendations();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const pointsBalance = rewardsWallet?.points_balance ?? 0;
  const walletValue = calculateRedemptionValue(pointsBalance);
  const recentOrders = [...(orders ?? [])].sort((a, b) => +new Date(b.placed_at) - +new Date(a.placed_at)).slice(0, 3);
  const wishlistProducts = wishlistItems.map((i) => i.product).filter(Boolean).slice(0, 4);
  const defaultAddress = addresses.find((a) => a.is_default) ?? addresses[0];
  const activeCoupons = (coupons ?? []).filter((c) => c.is_active).slice(0, 3);

  const handleSave = async () => {
    try {
      await updateProfile({ full_name: fullName, phone });
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    }
  };

  const handlePhotoChange = async (file: File) => {
    try {
      await uploadAvatar(file);
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Photo upload failed');
    }
  };

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  return (
    <div className="space-y-6">
      <Seo title="My Account" />

      <ProfileHeroCard
        user={user}
        pointsBalance={pointsBalance}
        walletValue={walletValue}
        orderCount={orders?.length ?? 0}
        wishlistCount={wishlistItems.length}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DashboardSection title="Recent Orders" icon={Package} viewAllHref="/orders">
            {isLoadingOrders ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="skeleton h-16 rounded-2xl" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-acc-text-secondary">No orders yet — your recent orders will show up here.</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-acc-border p-3 transition-colors hover:border-acc-primary/40 hover:bg-acc-primary/5 dark:border-primary-700"
                  >
                    <img src={order.items[0]?.product_image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{order.items[0]?.product_name}</p>
                      <p className="text-xs text-acc-text-secondary">
                        #{order.order_number} · {formatDate(order.placed_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={ORDER_STATUS_STYLES[order.status]}>{order.status.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-semibold text-acc-text dark:text-white">{formatCurrency(order.total)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </DashboardSection>

          <DashboardSection title="Wishlist" icon={Heart} viewAllHref="/wishlist">
            {isLoadingWishlist ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : wishlistProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-acc-text-secondary">Products you love will show up here.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {wishlistProducts.map((product) => (
                  <ProductCard key={product!.id} product={product!} />
                ))}
              </div>
            )}
          </DashboardSection>

          <DashboardSection title="Recently Viewed" icon={Clock}>
            {isLoadingRecent ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : recentlyViewed.length === 0 ? (
              <p className="py-6 text-center text-sm text-acc-text-secondary">Products you view will show up here.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {recentlyViewed.slice(0, 4).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </DashboardSection>

          {(isLoadingRecommendations || recommendations.length > 0) && (
            <DashboardSection title="Recommended For You" icon={Sparkles}>
              {isLoadingRecommendations ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {recommendations.slice(0, 4).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </DashboardSection>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <div className="mb-6 flex items-center gap-4">
              <div className="group relative">
                <Avatar src={avatarUrl} name={user.full_name} size="lg" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100"
                  title="Change photo"
                  aria-label="Change profile photo"
                >
                  <Camera size={18} />
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
                <h2 className="text-base font-bold leading-snug text-acc-text dark:text-white">Personal Information</h2>
                <p className="truncate text-xs text-acc-text-secondary">{isUploading ? 'Uploading photo…' : 'Keep your details up to date'}</p>
              </div>
            </div>

            <div className="space-y-5">
              <Input floating label="Full Name" leftIcon={<User size={16} />} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input floating label="Email Address" leftIcon={<Mail size={16} />} value={user.email} disabled />
              <Input floating label="Phone Number" leftIcon={<Phone size={16} />} value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button variant="account" onClick={handleSave} isLoading={isUpdating} fullWidth>
                Save Changes
              </Button>
            </div>
          </Card>

          <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
            <Link
              to="/rewards"
              className="flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-4 text-white shadow-[0_12px_28px_-14px_rgba(255,107,0,0.6)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Gift size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/80">Reward Points</p>
                <p className="font-bold">
                  {pointsBalance.toLocaleString('en-IN')} pts <span className="font-normal text-white/75">· {formatCurrency(walletValue)}</span>
                </p>
              </div>
            </Link>
          </motion.div>

          <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
            <Link to="/referrals" className="flex items-center gap-3 rounded-[20px] border border-acc-border bg-white p-4 dark:border-primary-700 dark:bg-card-dark">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acc-primary/10">
                <Users size={18} className="text-acc-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-acc-text-secondary">Refer a friend</p>
                <p className="font-bold text-acc-text dark:text-white">Give ₹150, get ₹200</p>
              </div>
            </Link>
          </motion.div>

          <DashboardSection title="Coupons" icon={Ticket} viewAllHref="/coupons">
            {isLoadingCoupons ? (
              <div className="space-y-2">
                <div className="skeleton h-12 rounded-2xl" />
                <div className="skeleton h-12 rounded-2xl" />
              </div>
            ) : activeCoupons.length === 0 ? (
              <p className="py-4 text-center text-sm text-acc-text-secondary">No coupons available right now.</p>
            ) : (
              <div className="space-y-2">
                {activeCoupons.map((coupon) => (
                  <button
                    key={coupon.id}
                    onClick={() => copyCoupon(coupon.code)}
                    className="flex w-full items-center justify-between rounded-2xl border border-dashed border-acc-primary/40 bg-acc-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-acc-primary/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-acc-primary">{coupon.code}</p>
                      <p className="truncate text-xs text-acc-text-secondary">{coupon.description}</p>
                    </div>
                    <Copy size={14} className="shrink-0 text-acc-primary" />
                  </button>
                ))}
              </div>
            )}
          </DashboardSection>

          <DashboardSection title="Delivery Addresses" icon={MapPin} viewAllHref="/addresses">
            {isLoadingAddresses ? (
              <div className="skeleton h-20 rounded-2xl" />
            ) : !defaultAddress ? (
              <Link
                to="/addresses"
                className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-acc-border py-6 text-sm font-medium text-acc-primary hover:bg-acc-primary/5"
              >
                <Plus size={16} /> Add an address
              </Link>
            ) : (
              <div className="rounded-2xl border border-acc-border p-3 dark:border-primary-700">
                <div className="mb-1 flex items-center gap-2">
                  <span className="badge-accent capitalize">{defaultAddress.type}</span>
                  <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{defaultAddress.full_name}</p>
                </div>
                <p className="text-xs leading-relaxed text-acc-text-secondary">
                  {defaultAddress.line1}, {defaultAddress.city}, {defaultAddress.state} {defaultAddress.pincode}
                </p>
              </div>
            )}
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}

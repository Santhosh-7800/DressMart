import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Ticket, MapPin, Sparkles, Package, Heart, Clock, Copy, Plus, Camera, Store, Clock3, ShieldAlert } from 'lucide-react';
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
import { useOrders } from '@/hooks/useOrders';
import { useWishlist } from '@/hooks/useWishlist';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useAddresses } from '@/hooks/useAddresses';
import { useCoupons } from '@/hooks/useCoupons';
import { usePersonalizedRecommendations } from '@/hooks/usePersonalizedRecommendations';
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

  const recentOrders = [...(orders ?? [])].sort((a, b) => +new Date(b.placed_at) - +new Date(a.placed_at)).slice(0, 3);
  const wishlistProducts = wishlistItems.map((i) => i.product).filter(Boolean).slice(0, 4);
  const defaultAddress = addresses.find((a) => a.is_default) ?? addresses[0];
  const activeCoupons = (coupons ?? []).slice(0, 3);

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

      <ProfileHeroCard user={user} orderCount={orders?.length ?? 0} wishlistCount={wishlistItems.length} />

      {user.role === 'buyer' && (
        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
          <Link
            to="/sell"
            className="flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-acc-primary to-acc-secondary p-4 text-white shadow-[0_12px_28px_-14px_rgba(255,107,0,0.6)] sm:p-5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Store size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Become a Seller</p>
              <p className="text-sm text-white/85">Start selling on DressMart — apply in under a minute.</p>
            </div>
          </Link>
        </motion.div>
      )}

      {(user.role === 'seller' || user.role === 'head_seller') && user.seller_status === 'pending' && (
        <div className="flex items-center gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <Clock3 size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Your seller application is under review</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">We'll notify you once the Head Seller approves your store, {user.store_name ?? 'your store'}.</p>
          </div>
        </div>
      )}

      {user.seller_status === 'suspended' && (
        <div className="flex items-center gap-3 rounded-[20px] border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/10">
          <ShieldAlert size={20} className="shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-red-800 dark:text-red-300">Your seller account has been suspended</p>
            {user.seller_status_reason && <p className="text-xs text-red-700/80 dark:text-red-400/80">{user.seller_status_reason}</p>}
          </div>
        </div>
      )}

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

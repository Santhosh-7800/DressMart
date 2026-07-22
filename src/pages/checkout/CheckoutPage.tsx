import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MapPin, Plus, CheckCircle2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useAddresses } from '@/hooks/useAddresses';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductImage } from '@/components/ui/ProductImage';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatCurrency } from '@/lib/utils';
import type { Coupon } from '@/types';

const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 79;
const TAX_RATE = 0.05;

interface AddressFormState {
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  type: 'home' | 'work' | 'other';
}

const EMPTY_ADDRESS: AddressFormState = { full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', landmark: '', type: 'home' };

export function CheckoutPage() {
  const navigate = useNavigate();
  const { addresses, addAddress, isLoading } = useAddresses();
  const { items, subtotal, totalDiscount, totalItems } = useCart();
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<AddressFormState>(EMPTY_ADDRESS);

  const coupon: Coupon | null = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('dressmart:checkout-coupon') ?? 'null');
    } catch {
      return null;
    }
  })();

  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  let couponDiscount = 0;
  if (coupon) {
    couponDiscount = coupon.discount_type === 'percent' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
    if (coupon.max_discount) couponDiscount = Math.min(couponDiscount, coupon.max_discount);
  }
  const tax = Math.round(Math.max(subtotal - couponDiscount, 0) * TAX_RATE);
  const total = Math.round(Math.max(subtotal - couponDiscount, 0) + tax + shippingFee);

  const effectiveAddressId = selectedAddressId ?? addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;

  const handleAddAddress = async () => {
    if (!form.full_name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      toast.error('Please fill in all required fields');
      return;
    }
    const updated = await addAddress({ ...form, line2: form.line2 || null, landmark: form.landmark || null, is_default: addresses.length === 0 });
    const newest = updated[updated.length - 1];
    setSelectedAddressId(newest?.id ?? null);
    setIsModalOpen(false);
    setForm(EMPTY_ADDRESS);
  };

  const handleContinue = () => {
    if (!effectiveAddressId) {
      toast.error('Please select or add a delivery address');
      return;
    }
    navigate('/checkout/payment', { state: { addressId: effectiveAddressId } });
  };

  if (items.length === 0) {
    return (
      <div className="container-app py-12">
        <EmptyState icon={MapPin} title="Your cart is empty" description="Add items to your cart before checking out." actionLabel="Start Shopping" actionHref="/" />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <Seo title="Checkout" />
      <div className="mb-6 flex items-center gap-3">
        {user && <Avatar src={avatarUrl} name={user.full_name} size="sm" />}
        <h1 className="text-2xl font-bold">Checkout</h1>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">1. Delivery Address</h2>
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1 text-sm font-medium text-accent-600">
                <Plus size={15} /> Add New
              </button>
            </div>
            {isLoading ? (
              <p className="text-sm text-primary-400">Loading addresses…</p>
            ) : addresses.length === 0 ? (
              <p className="text-sm text-primary-400">No saved addresses. Add one to continue.</p>
            ) : (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    onClick={() => setSelectedAddressId(address.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-4 text-left',
                      effectiveAddressId === address.id ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600',
                    )}
                  >
                    <div className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', effectiveAddressId === address.id ? 'border-accent bg-accent' : 'border-primary-300')}>
                      {effectiveAddressId === address.id && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold">
                        {address.full_name} <span className="ml-1 rounded bg-primary-100 px-1.5 py-0.5 text-[10px] uppercase dark:bg-primary-700">{address.type}</span>
                      </p>
                      <p className="text-primary-500">
                        {address.line1}, {address.line2 ? `${address.line2}, ` : ''}
                        {address.city}, {address.state} - {address.pincode}
                      </p>
                      <p className="text-primary-400">Phone: {address.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card-surface p-5">
            <h2 className="mb-4 font-semibold">2. Shipping Method</h2>
            <div className="rounded-xl border border-accent bg-accent-50 p-4 text-sm dark:bg-accent-900/10">
              <p className="font-medium">Standard Delivery — {shippingFee === 0 ? 'FREE' : formatCurrency(shippingFee)}</p>
              <p className="text-primary-400">Estimated delivery in 4-5 business days</p>
            </div>
          </div>

          <div className="card-surface p-5">
            <h2 className="mb-4 font-semibold">3. Review Order ({totalItems} items)</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <ProductImage src={item.product?.imageUrl ?? item.product?.images[0]?.url} alt="" className="h-14 w-12 rounded-md" priority />
                  <div className="flex-1">
                    <p className="line-clamp-1 font-medium">{item.product?.name}</p>
                    <p className="text-xs text-primary-400">
                      Size: {item.variant?.size} · Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency((item.variant?.price_override ?? item.product?.price ?? 0) * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <OrderSummary itemCount={totalItems} subtotal={subtotal} discount={totalDiscount} couponDiscount={couponDiscount} shippingFee={shippingFee} tax={tax} total={total}>
            <Button variant="accent" fullWidth size="lg" className="mt-4" onClick={handleContinue}>
              Continue to Payment
            </Button>
          </OrderSummary>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Address">
        <div className="space-y-3">
          <Input name="full_name" label="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input name="phone" label="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input name="line1" label="Address Line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
          <Input name="line2" label="Address Line 2 (optional)" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input name="city" label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input name="state" label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input name="pincode" label="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            <Input name="landmark" label="Landmark (optional)" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Address Type</p>
            <div className="flex gap-2">
              {(['home', 'work', 'other'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setForm({ ...form, type })}
                  className={cn('rounded-lg border px-3 py-1.5 text-xs capitalize', form.type === type ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600')}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <Button variant="accent" fullWidth onClick={handleAddAddress}>
            Save Address
          </Button>
        </div>
      </Modal>
    </div>
  );
}

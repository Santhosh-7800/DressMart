import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, getDocs, query, updateDoc, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { MapPin, Plus, CheckCircle2, CreditCard, Banknote } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useCheckoutItems } from '@/hooks/useCheckoutItems';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductImage } from '@/components/ui/ProductImage';
import { Avatar } from '@/components/ui/Avatar';
import { AddressFormFields } from '@/components/address/AddressFormFields';
import { EMPTY_ADDRESS_FORM, isAddressFormValid, type AddressFormValues } from '@/lib/addressValidation';
import { db } from '@/lib/firebase';
import { cn, formatCurrency } from '@/lib/utils';
import type { Address, Coupon, PaymentMethod } from '@/types';

const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 79;
const TAX_RATE = 0.05;

/**
 * Address CRUD is read/written directly against Firestore here rather than through
 * addressService/useAddresses — that module may be mid-migration by another workstream
 * concurrently; per firestore.rules, any signed-in user may read/write their own `addresses/*`.
 */
async function fetchAddresses(userId: string): Promise<Address[]> {
  const snap = await getDocs(query(collection(db, 'addresses'), where('user_id', '==', userId)));
  const addresses = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Address);
  return addresses.sort((a, b) => Number(b.is_default) - Number(a.is_default));
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, subtotal, totalDiscount, totalItems, isLoading: isLoadingItems } = useCheckoutItems();
  const { avatarUrl } = useAvatar();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<AddressFormValues>(EMPTY_ADDRESS_FORM);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Pre-selects whatever the shopper last picked as their default on the Payments page (see
  // PaymentsPage.tsx) — a plain local preference, not a Firestore field. Still fully overridable
  // per order via the buttons below.
  const [preferredMethod] = useLocalStorage<PaymentMethod>('dressmart:preferred-payment-method', 'razorpay');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(preferredMethod);

  const addressesQuery = useQuery({
    queryKey: ['addresses', userId],
    queryFn: () => fetchAddresses(userId),
    enabled: Boolean(userId),
  });
  const addresses = addressesQuery.data ?? [];

  const addAddressMutation = useMutation({
    mutationFn: async (address: Omit<Address, 'id' | 'user_id'>) => {
      if (address.is_default) {
        const existing = await getDocs(query(collection(db, 'addresses'), where('user_id', '==', userId)));
        await Promise.all(existing.docs.map((d) => updateDoc(d.ref, { is_default: false })));
      }
      const ref = await addDoc(collection(db, 'addresses'), { ...address, user_id: userId, is_default: address.is_default || addresses.length === 0 });
      return ref.id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['addresses', userId] });
      setSelectedAddressId(newId);
      toast.success('Address saved');
    },
  });

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
    if (!isAddressFormValid(form)) {
      setSubmitAttempted(true);
      toast.error('Please fix the highlighted fields');
      return;
    }
    await addAddressMutation.mutateAsync({ ...form, line2: form.line2 || null, landmark: form.landmark || null, is_default: addresses.length === 0 });
    setIsModalOpen(false);
    setForm(EMPTY_ADDRESS_FORM);
    setSubmitAttempted(false);
  };

  const handleContinue = () => {
    if (!effectiveAddressId) {
      toast.error('Please select or add a delivery address');
      return;
    }
    navigate('/checkout/payment', { state: { addressId: effectiveAddressId, paymentMethod } });
  };

  if (items.length === 0 && !isLoadingItems) {
    return (
      <div className="container-app py-12">
        <EmptyState icon={MapPin} title="Your cart is empty" description="Add items to your cart before checking out." actionLabel="Start Shopping" actionHref="/" />
      </div>
    );
  }

  return (
    <div className="container-app pt-8 pb-24 md:pb-8">
      <Seo title="Checkout" />
      <div className="mb-6 hidden items-center gap-3 md:flex">
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
            {addressesQuery.isLoading ? (
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
                    <div className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', effectiveAddressId === address.id ? 'border-accent bg-accent' : 'border-primary-300 dark:border-primary-600')}>
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
            <h2 className="mb-4 font-semibold">3. Payment Method</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('razorpay')}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-4 text-sm font-medium',
                  paymentMethod === 'razorpay' ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600',
                )}
              >
                <CreditCard size={18} /> Razorpay (UPI / Card / Netbanking)
              </button>
              <button
                onClick={() => setPaymentMethod('cod')}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-4 text-sm font-medium',
                  paymentMethod === 'cod' ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600',
                )}
              >
                <Banknote size={18} /> Cash on Delivery
              </button>
            </div>
          </div>

          <div className="card-surface p-5">
            <h2 className="mb-4 font-semibold">4. Review Order ({totalItems} items)</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <ProductImage src={item.image || item.product?.coverImage || item.product?.imageUrl} alt="" className="h-14 w-12 rounded-md" priority />
                  <div className="flex-1">
                    <p className="line-clamp-1 font-medium">{item.product?.name}</p>
                    <p className="text-xs text-primary-400">
                      {item.color} · Size: {item.size} · Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency((item.variant?.price_override ?? item.product?.price ?? item.price) * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {coupon && (
            <div className="card-surface mb-4 p-4 text-sm">
              <p className="font-medium text-emerald-600">Coupon "{coupon.code}" applied</p>
            </div>
          )}
          <OrderSummary itemCount={totalItems} subtotal={subtotal} discount={totalDiscount} couponDiscount={couponDiscount} shippingFee={shippingFee} tax={tax} total={total}>
            <Button variant="accent" fullWidth size="lg" className="mt-4 hidden md:block" onClick={handleContinue}>
              Continue to Payment
            </Button>
          </OrderSummary>
        </div>
      </div>

      {/* Mobile sticky bar — BottomNavBar is already hidden on /checkout* routes (see
          MainLayout), so this sits flush at the bottom instead of stacking above it. pb-safe on
          the outer element adds clearance below the p-3 content on notched devices, rather than
          conflicting with it (both setting padding-bottom on the same element would just have one
          override the other). */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-primary-100 bg-surface shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden dark:border-primary-700 dark:bg-surface-dark">
        <div className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-primary-400">Total</p>
            <p className="truncate text-lg font-bold">{formatCurrency(total)}</p>
          </div>
          <Button variant="accent" size="md" onClick={handleContinue} className="shrink-0">
            Continue to Payment
          </Button>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Address">
        <AddressFormFields value={form} onChange={setForm} submitAttempted={submitAttempted} />
        <Button
          variant="accent"
          fullWidth
          className="mt-3"
          onClick={handleAddAddress}
          isLoading={addAddressMutation.isPending}
          disabled={!isAddressFormValid(form)}
        >
          Save Address
        </Button>
      </Modal>
    </div>
  );
}

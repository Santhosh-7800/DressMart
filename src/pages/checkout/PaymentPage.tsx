import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Smartphone, CreditCard, Landmark, Wallet, Banknote } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCart } from '@/hooks/useCart';
import { useAddresses } from '@/hooks/useAddresses';
import { usePlaceOrder } from '@/hooks/useOrders';
import { useRewardsWallet, useRedeemPoints } from '@/hooks/useRewards';
import { useAuth } from '@/contexts/AuthContext';
import { paymentService } from '@/services/paymentService';
import { couponService } from '@/services/couponService';
import { calculateRedemptionValue, REDEEM_POINTS_PER_RUPEE } from '@/services/rewardsService';
import { RewardsRedemptionCard } from '@/components/rewards/RewardsRedemptionCard';
import { cn } from '@/lib/utils';
import type { Coupon, PaymentMethod } from '@/types';

const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 79;
const TAX_RATE = 0.05;

const METHODS: { value: PaymentMethod; label: string; icon: typeof Smartphone }[] = [
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
  { value: 'debit_card', label: 'Debit Card', icon: CreditCard },
  { value: 'net_banking', label: 'Net Banking', icon: Landmark },
  { value: 'wallet', label: 'Wallet', icon: Wallet },
  { value: 'cod', label: 'Cash on Delivery', icon: Banknote },
];

const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'];
const WALLETS = ['PayTM', 'PhonePe Wallet', 'Amazon Pay', 'MobiKwik'];

export function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const addressId = (location.state as { addressId?: string } | null)?.addressId;
  const { identityId } = useAuth();
  const { addresses } = useAddresses();
  const { items, subtotal, totalItems, clearCart } = useCart();
  const placeOrder = usePlaceOrder();
  const { data: rewardsWallet } = useRewardsWallet();
  const redeemPoints = useRedeemPoints();

  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [walletProvider, setWalletProvider] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const coupon: Coupon | null = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('dressmart:checkout-coupon') ?? 'null');
    } catch {
      return null;
    }
  })();

  const address = addresses.find((a) => a.id === addressId);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  let couponDiscount = 0;
  if (coupon) {
    couponDiscount = coupon.discount_type === 'percent' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
    if (coupon.max_discount) couponDiscount = Math.min(couponDiscount, coupon.max_discount);
  }

  const pointsBalance = rewardsWallet?.points_balance ?? 0;
  const maxRedeemablePoints = Math.min(pointsBalance, Math.floor(Math.max(subtotal - couponDiscount, 0) * REDEEM_POINTS_PER_RUPEE));
  const pointsDiscount = calculateRedemptionValue(pointsToRedeem);

  const taxableAmount = Math.max(subtotal - couponDiscount - pointsDiscount, 0);
  const tax = Math.round(taxableAmount * TAX_RATE);
  const total = Math.round(taxableAmount + tax + shippingFee);

  if (!addressId || !address) {
    return (
      <div className="container-app py-12 text-center">
        <p className="text-sm text-primary-400">Please select a delivery address first.</p>
        <Button className="mt-4" onClick={() => navigate('/checkout')}>
          Back to Checkout
        </Button>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    try {
      let validCoupon = coupon;
      if (coupon) {
        try {
          validCoupon = await couponService.validate(coupon.code, subtotal, identityId);
        } catch {
          validCoupon = null;
        }
      }

      const chargeResult = await paymentService.charge({
        amount: total,
        currency: 'INR',
        orderNumber: `PENDING-${Date.now()}`,
        method,
        details: { upiId, cardNumber, cardExpiry, cardCvv, cardHolderName, bankCode, walletProvider },
      });

      if (!chargeResult.success) {
        toast.error(chargeResult.message);
        setIsProcessing(false);
        return;
      }

      const order = await placeOrder.mutateAsync({
        cartItems: items,
        address,
        paymentMethod: method,
        coupon: validCoupon,
        shippingFee,
        taxRate: TAX_RATE,
        pointsDiscount,
      });

      if (pointsToRedeem > 0) {
        await redeemPoints.mutateAsync({ points: pointsToRedeem, orderId: order.id });
      }

      sessionStorage.removeItem('dressmart:checkout-coupon');
      await clearCart();
      navigate(`/order-success/${order.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container-app py-8">
      <Seo title="Payment" />
      <h1 className="mb-6 text-2xl font-bold">Payment</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card-surface p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {METHODS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setMethod(value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium',
                  method === value ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600',
                )}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {method === 'upi' && <Input label="UPI ID" placeholder="yourname@bank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />}

            {(method === 'credit_card' || method === 'debit_card') && (
              <>
                <Input label="Card Holder Name" value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} />
                <Input label="Card Number" placeholder="1234 5678 9012 3456" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Expiry (MM/YY)" placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} />
                  <Input label="CVV" type="password" maxLength={4} value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} />
                </div>
              </>
            )}

            {method === 'net_banking' && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Select Bank</p>
                <div className="grid grid-cols-2 gap-2">
                  {BANKS.map((bank) => (
                    <button
                      key={bank}
                      onClick={() => setBankCode(bank)}
                      className={cn('rounded-lg border p-2.5 text-left text-sm', bankCode === bank ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600')}
                    >
                      {bank}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === 'wallet' && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Select Wallet</p>
                <div className="grid grid-cols-2 gap-2">
                  {WALLETS.map((wallet) => (
                    <button
                      key={wallet}
                      onClick={() => setWalletProvider(wallet)}
                      className={cn('rounded-lg border p-2.5 text-left text-sm', walletProvider === wallet ? 'border-accent bg-accent-50 dark:bg-accent-900/10' : 'border-primary-200 dark:border-primary-600')}
                    >
                      {wallet}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === 'cod' && <p className="rounded-xl bg-primary-50 p-4 text-sm text-primary-500 dark:bg-primary-800">Pay in cash when your order is delivered. A small COD fee may apply.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <RewardsRedemptionCard
            pointsBalance={pointsBalance}
            maxRedeemablePoints={maxRedeemablePoints}
            pointsToRedeem={pointsToRedeem}
            onChange={setPointsToRedeem}
          />
          <OrderSummary
            itemCount={totalItems}
            subtotal={subtotal}
            discount={0}
            couponDiscount={couponDiscount}
            pointsDiscount={pointsDiscount}
            shippingFee={shippingFee}
            tax={tax}
            total={total}
          >
            <Button variant="accent" fullWidth size="lg" className="mt-4" onClick={handlePlaceOrder} isLoading={isProcessing}>
              Place Order
            </Button>
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { Store, Bell, LogOut, Image as ImageIcon, MapPin, CreditCard, Truck } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';
import { isAcceptedImageFile, uploadShopBanner, uploadShopLogo } from '@/services/storageService';
import { resizeAndCompressImage, resizeAndCompressImageToWidth } from '@/lib/imageProcessing';
import type { ShopAddress } from '@/types';

interface NotificationPrefs {
  new_orders: boolean;
  low_stock: boolean;
  returns_exchanges: boolean;
}

const BLANK_ADDRESS: ShopAddress = { line1: '', line2: null, city: '', state: '', pincode: '', landmark: null };

/** Profile doc doesn't declare notification prefs yet (Firestore is schemaless) — stored as a plain extra field. */
function readNotificationPrefs(raw: unknown): NotificationPrefs {
  const prefs = (raw ?? {}) as Partial<NotificationPrefs>;
  return {
    new_orders: prefs.new_orders ?? true,
    low_stock: prefs.low_stock ?? true,
    returns_exchanges: prefs.returns_exchanges ?? true,
  };
}

function AddressFields({ value, onChange }: { value: ShopAddress; onChange: (next: ShopAddress) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Input floating label="Address Line 1" value={value.line1} onChange={(e) => onChange({ ...value, line1: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <Input floating label="Address Line 2 (optional)" value={value.line2 ?? ''} onChange={(e) => onChange({ ...value, line2: e.target.value || null })} />
      </div>
      <Input floating label="City" value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} />
      <Input floating label="State" value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })} />
      <Input floating label="Pincode" value={value.pincode} onChange={(e) => onChange({ ...value, pincode: e.target.value })} />
      <Input floating label="Landmark (optional)" value={value.landmark ?? ''} onChange={(e) => onChange({ ...value, landmark: e.target.value || null })} />
    </div>
  );
}

export function SellerSettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [storeName, setStoreName] = useState(user?.store_name ?? '');
  const [gstNumber, setGstNumber] = useState(user?.gst_number ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => readNotificationPrefs((user as unknown as { notification_prefs?: unknown })?.notification_prefs));

  const [logoUrl, setLogoUrl] = useState(user?.shop_logo_url ?? null);
  const [bannerUrl, setBannerUrl] = useState(user?.shop_banner_url ?? null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const [pickupAddress, setPickupAddress] = useState<ShopAddress>(user?.pickup_address ?? BLANK_ADDRESS);
  const [returnSameAsPickup, setReturnSameAsPickup] = useState(!user?.return_address);
  const [returnAddress, setReturnAddress] = useState<ShopAddress>(user?.return_address ?? BLANK_ADDRESS);

  const [bankHolder, setBankHolder] = useState(user?.bank_account_holder ?? '');
  const [bankAccount, setBankAccount] = useState(user?.bank_account_number ?? '');
  const [bankIfsc, setBankIfsc] = useState(user?.bank_ifsc ?? '');

  const [codAvailable, setCodAvailable] = useState(user?.shop_cod_available ?? true);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be signed in.');
      await updateDoc(doc(db, 'users', user.id), {
        store_name: storeName.trim(),
        gst_number: gstNumber.trim(),
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => toast.success('Store profile updated'),
    onError: (error: Error) => toast.error(error.message || 'Could not save changes.'),
  });

  const savePrefsMutation = useMutation({
    mutationFn: async (next: NotificationPrefs) => {
      if (!user) throw new Error('You must be signed in.');
      await updateDoc(doc(db, 'users', user.id), { notification_prefs: next, updated_at: new Date().toISOString() });
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save preferences.'),
  });

  const saveAddressesMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be signed in.');
      await updateDoc(doc(db, 'users', user.id), {
        pickup_address: pickupAddress,
        return_address: returnSameAsPickup ? pickupAddress : returnAddress,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => toast.success('Addresses updated'),
    onError: (error: Error) => toast.error(error.message || 'Could not save addresses.'),
  });

  const saveBankDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be signed in.');
      await updateDoc(doc(db, 'users', user.id), {
        bank_account_holder: bankHolder.trim(),
        bank_account_number: bankAccount.trim(),
        bank_ifsc: bankIfsc.trim(),
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => toast.success('Bank details updated'),
    onError: (error: Error) => toast.error(error.message || 'Could not save bank details.'),
  });

  const saveCodMutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!user) throw new Error('You must be signed in.');
      await updateDoc(doc(db, 'users', user.id), { shop_cod_available: next, updated_at: new Date().toISOString() });
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save preference.'),
  });

  const togglePref = (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    savePrefsMutation.mutate(next);
  };

  const toggleCod = () => {
    const next = !codAvailable;
    setCodAvailable(next);
    saveCodMutation.mutate(next);
  };

  const handleLogoChange = async (file: File) => {
    if (!user) return;
    if (!isAcceptedImageFile(file)) return toast.error('Only JPG, PNG, or WEBP images are supported.');
    if (file.size > 4 * 1024 * 1024) return toast.error('Image must be smaller than 4MB.');
    setIsUploadingLogo(true);
    try {
      const processed = await resizeAndCompressImage(file, 512, 0.85);
      const url = await uploadShopLogo(processed, user.id);
      await updateDoc(doc(db, 'users', user.id), { shop_logo_url: url, updated_at: new Date().toISOString() });
      setLogoUrl(url);
      toast.success('Shop logo updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Logo upload failed.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleBannerChange = async (file: File) => {
    if (!user) return;
    if (!isAcceptedImageFile(file)) return toast.error('Only JPG, PNG, or WEBP images are supported.');
    if (file.size > 4 * 1024 * 1024) return toast.error('Image must be smaller than 4MB.');
    setIsUploadingBanner(true);
    try {
      const processed = await resizeAndCompressImageToWidth(file, 1600, 0.85);
      const url = await uploadShopBanner(processed, user.id);
      await updateDoc(doc(db, 'users', user.id), { shop_banner_url: url, updated_at: new Date().toISOString() });
      setBannerUrl(url);
      toast.success('Shop banner updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Banner upload failed.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Seo title="Seller Settings" />
      <h1 className="text-2xl font-bold text-acc-text dark:text-white">Profile & Settings</h1>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <Store size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Store Profile</h2>
        </div>
        <div className="space-y-4">
          <Input floating label="Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <Input floating label="GST Number" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
          <Input floating label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input floating label="Email" value={user.email} disabled />
          {user.seller_status && (
            <p className="text-xs text-acc-text-secondary">
              Account status: <span className="font-semibold capitalize">{user.seller_status}</span>
              {isHeadSeller(user.role) && ' · Head Seller'}
            </p>
          )}
          <Button variant="account" onClick={() => saveProfileMutation.mutate()} isLoading={saveProfileMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <ImageIcon size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Shop Branding</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-acc-text dark:text-white">Shop Logo</p>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-acc-border bg-primary-50 dark:border-primary-700 dark:bg-primary-800">
                {logoUrl ? <img src={logoUrl} alt="Shop logo" className="h-full w-full object-cover" /> : <Store size={22} className="text-primary-300" />}
              </div>
              <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} isLoading={isUploadingLogo}>
                Upload
              </Button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoChange(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-acc-text dark:text-white">Shop Banner</p>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-2xl border border-acc-border bg-primary-50 dark:border-primary-700 dark:bg-primary-800">
                {bannerUrl ? <img src={bannerUrl} alt="Shop banner" className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-primary-300" />}
              </div>
              <Button variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()} isLoading={isUploadingBanner}>
                Upload
              </Button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBannerChange(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <MapPin size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Pickup Address</h2>
        </div>
        <AddressFields value={pickupAddress} onChange={setPickupAddress} />
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <MapPin size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Return Address</h2>
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm text-acc-text dark:text-white">
          <input type="checkbox" checked={returnSameAsPickup} onChange={(e) => setReturnSameAsPickup(e.target.checked)} className="h-4 w-4 accent-acc-primary" />
          Same as pickup address
        </label>
        {!returnSameAsPickup && <AddressFields value={returnAddress} onChange={setReturnAddress} />}
        <Button variant="account" className="mt-4" onClick={() => saveAddressesMutation.mutate()} isLoading={saveAddressesMutation.isPending}>
          Save Addresses
        </Button>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <CreditCard size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Bank Details</h2>
        </div>
        <p className="mb-4 text-xs text-acc-text-secondary">Informational only — used for payout coordination outside the app.</p>
        <div className="space-y-4">
          <Input floating label="Account Holder Name" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} />
          <Input floating label="Account Number" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
          <Input floating label="IFSC Code" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} />
          <Button variant="account" onClick={() => saveBankDetailsMutation.mutate()} isLoading={saveBankDetailsMutation.isPending}>
            Save Bank Details
          </Button>
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <Truck size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Shop Preferences</h2>
        </div>
        <label className="flex items-center justify-between rounded-2xl border border-acc-border px-4 py-3 text-sm dark:border-primary-700">
          <span className="text-acc-text dark:text-white">Cash on Delivery available for this shop</span>
          <input type="checkbox" checked={codAvailable} onChange={toggleCod} className="h-4 w-4 accent-acc-primary" />
        </label>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <Bell size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Notification Preferences</h2>
        </div>
        <div className="space-y-3">
          {(
            [
              { key: 'new_orders', label: 'New order alerts' },
              { key: 'low_stock', label: 'Low stock alerts' },
              { key: 'returns_exchanges', label: 'Return & exchange requests' },
            ] as { key: keyof NotificationPrefs; label: string }[]
          ).map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between rounded-2xl border border-acc-border px-4 py-3 text-sm dark:border-primary-700">
              <span className="text-acc-text dark:text-white">{label}</span>
              <input type="checkbox" checked={prefs[key]} onChange={() => togglePref(key)} className="h-4 w-4 accent-acc-primary" />
            </label>
          ))}
        </div>
      </Card>

      <Card hover={false} className="border-red-200 dark:border-red-900/40">
        <Button variant="danger" onClick={handleSignOut}>
          <LogOut size={16} /> Sign Out
        </Button>
      </Card>
    </div>
  );
}

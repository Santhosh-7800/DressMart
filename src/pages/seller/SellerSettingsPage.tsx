import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { Store, Bell, LogOut } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';

interface NotificationPrefs {
  new_orders: boolean;
  low_stock: boolean;
  returns_exchanges: boolean;
}

/** Profile doc doesn't declare notification prefs yet (Firestore is schemaless) — stored as a plain extra field. */
function readNotificationPrefs(raw: unknown): NotificationPrefs {
  const prefs = (raw ?? {}) as Partial<NotificationPrefs>;
  return {
    new_orders: prefs.new_orders ?? true,
    low_stock: prefs.low_stock ?? true,
    returns_exchanges: prefs.returns_exchanges ?? true,
  };
}

export function SellerSettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState(user?.store_name ?? '');
  const [gstNumber, setGstNumber] = useState(user?.gst_number ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => readNotificationPrefs((user as unknown as { notification_prefs?: unknown })?.notification_prefs));

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

  const togglePref = (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    savePrefsMutation.mutate(next);
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

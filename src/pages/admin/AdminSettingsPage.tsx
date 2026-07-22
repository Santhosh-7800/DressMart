import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, Store, Image, Truck, FileText } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { storeSettingsService } from '@/services/storeSettingsService';
import { uploadProductImage } from '@/services/storageService';
import type { StoreSettings } from '@/types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-admin-text">{label}</span>
      {children}
    </label>
  );
}

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'store-settings'], queryFn: () => storeSettingsService.get() });
  const [form, setForm] = useState<StoreSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (settings: StoreSettings) => storeSettingsService.save(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'store-settings'] });
      toast.success('Settings saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleImageUpload = async (file: File, key: 'logo_url' | 'banner_url') => {
    if (!form) return;
    try {
      const url = await uploadProductImage(file);
      setForm({ ...form, [key]: url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  if (isLoading || !form) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Seo title="Admin — Settings" />
      <div className="mb-5 flex items-center gap-2">
        <SettingsIcon size={22} className="text-admin-orange" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        <section className="card-surface grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h2 className="col-span-full flex items-center gap-2 font-semibold">
            <Store size={18} className="text-admin-orange" /> Store Details
          </h2>
          <Field label="Store Name">
            <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="GST Number">
            <Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
          </Field>
          <div className="col-span-full">
            <Field label="Store Address">
              <textarea className="input-field" rows={2} value={form.store_address} onChange={(e) => setForm({ ...form, store_address: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="card-surface grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h2 className="col-span-full flex items-center gap-2 font-semibold">
            <Image size={18} className="text-admin-orange" /> Branding
          </h2>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-cover" />}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo_url')} className="text-sm" />
            </div>
          </Field>
          <Field label="Banner">
            <div className="flex items-center gap-3">
              {form.banner_url && <img src={form.banner_url} alt="Banner" className="h-12 w-20 rounded-lg object-cover" />}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner_url')} className="text-sm" />
            </div>
          </Field>
        </section>

        <section className="card-surface grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h2 className="col-span-full flex items-center gap-2 font-semibold">
            <Truck size={18} className="text-admin-orange" /> Shipping
          </h2>
          <Field label="Shipping Charge (₹)">
            <Input type="number" value={form.shipping_charge} onChange={(e) => setForm({ ...form, shipping_charge: Number(e.target.value) })} />
          </Field>
          <Field label="Free Shipping Above (₹)">
            <Input type="number" value={form.free_shipping_threshold} onChange={(e) => setForm({ ...form, free_shipping_threshold: Number(e.target.value) })} />
          </Field>
        </section>

        <section className="card-surface space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FileText size={18} className="text-admin-orange" /> Policies
          </h2>
          <Field label="Return Policy">
            <textarea className="input-field min-h-24" value={form.return_policy} onChange={(e) => setForm({ ...form, return_policy: e.target.value })} />
          </Field>
          <Field label="Privacy Policy">
            <textarea className="input-field min-h-24" value={form.privacy_policy} onChange={(e) => setForm({ ...form, privacy_policy: e.target.value })} />
          </Field>
        </section>

        <div className="flex justify-end">
          <Button variant="accent" onClick={() => save.mutate(form)} isLoading={save.isPending}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

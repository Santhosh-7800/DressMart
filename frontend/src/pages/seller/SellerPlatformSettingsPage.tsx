import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SlidersHorizontal, Truck, FileText, ShieldCheck, Percent } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { queryKeys } from '@/lib/queryClient';
import { platformSettingsService } from '@/services/platformSettingsService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import type { PlatformSettings } from '@/types';

type FormState = Omit<PlatformSettings, 'id' | 'updated_at'>;

function toForm(settings: PlatformSettings): FormState {
  const { id: _id, updated_at: _updatedAt, ...rest } = settings;
  return rest;
}

export function SellerPlatformSettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: queryKeys.seller.platformSettings, queryFn: () => platformSettingsService.get() });
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (settingsQuery.data) setForm(toForm(settingsQuery.data));
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (updates: FormState) => platformSettingsService.save(updates),
    onSuccess: () => {
      toast.success('Platform settings saved');
      queryClient.invalidateQueries({ queryKey: queryKeys.seller.platformSettings });
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not save settings.')),
  });

  if (settingsQuery.isLoading || !form) {
    return (
      <div className="space-y-6">
        <Seo title="Platform Settings" />
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Platform Settings</h1>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="space-y-6">
      <Seo title="Platform Settings" />
      <h1 className="text-2xl font-bold text-acc-text dark:text-white">Platform Settings</h1>
      <p className="-mt-4 text-sm text-acc-text-secondary">These settings apply platform-wide, across every seller's storefront.</p>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Store Identity</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input floating label="Store Name" value={form.store_name} onChange={(e) => update('store_name', e.target.value)} />
          <Input floating label="GST Number" value={form.gst_number} onChange={(e) => update('gst_number', e.target.value)} />
          <Input floating label="Support Email" type="email" value={form.support_email} onChange={(e) => update('support_email', e.target.value)} />
          <Input floating label="Support Phone" value={form.support_phone} onChange={(e) => update('support_phone', e.target.value)} />
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <Truck size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Shipping & Windows</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            floating
            label="Shipping Charge (₹)"
            type="number"
            value={form.shipping_charge}
            onChange={(e) => update('shipping_charge', Number(e.target.value))}
          />
          <Input
            floating
            label="Free Shipping Threshold (₹)"
            type="number"
            value={form.free_shipping_threshold}
            onChange={(e) => update('free_shipping_threshold', Number(e.target.value))}
          />
          <Input
            floating
            label="Return Window (days)"
            type="number"
            value={form.return_window_days}
            onChange={(e) => update('return_window_days', Number(e.target.value))}
          />
          <Input
            floating
            label="Exchange Window (days)"
            type="number"
            value={form.exchange_window_days}
            onChange={(e) => update('exchange_window_days', Number(e.target.value))}
          />
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <Percent size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Commission</h2>
        </div>
        <p className="mb-4 text-sm text-acc-text-secondary">
          The percentage of paid-order revenue the platform keeps — drives the dashboard's Platform Earnings / Seller Earnings split.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            floating
            label="Commission Rate (%)"
            type="number"
            min={0}
            max={100}
            value={form.commission_rate_percent}
            onChange={(e) => update('commission_rate_percent', Number(e.target.value))}
          />
        </div>
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <FileText size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Return Policy</h2>
        </div>
        <textarea
          value={form.return_policy}
          onChange={(e) => update('return_policy', e.target.value)}
          rows={5}
          className="input-field resize-y"
        />
      </Card>

      <Card hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={17} className="text-acc-primary" />
          <h2 className="text-base font-bold text-acc-text dark:text-white">Privacy Policy</h2>
        </div>
        <textarea
          value={form.privacy_policy}
          onChange={(e) => update('privacy_policy', e.target.value)}
          rows={5}
          className="input-field resize-y"
        />
      </Card>

      <div className="flex justify-end">
        <Button variant="account" onClick={() => form && saveMutation.mutate(form)} isLoading={saveMutation.isPending}>
          Save Settings
        </Button>
      </div>
    </div>
  );
}

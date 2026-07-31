import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Power, Image as ImageIcon } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { bannerService } from '@/services/bannerService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { uploadBannerImage, isAcceptedImageFile } from '@/services/storageService';
import { useAuth } from '@/contexts/AuthContext';
import type { Banner } from '@/types';

type BannerFormState = {
  image_url: string;
  title: string;
  subtitle: string;
  link: string;
  sort_order: number;
  is_active: boolean;
};

const EMPTY_FORM: BannerFormState = { image_url: '', title: '', subtitle: '', link: '/', sort_order: 0, is_active: true };

function bannerToForm(banner: Banner): BannerFormState {
  return {
    image_url: banner.image_url ?? '',
    title: banner.title,
    subtitle: banner.subtitle ?? '',
    link: banner.link,
    sort_order: banner.sort_order,
    is_active: banner.is_active,
  };
}

export function SellerBannersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [isUploading, setIsUploading] = useState(false);

  const bannersQuery = useQuery({ queryKey: ['banners', 'all'], queryFn: () => bannerService.listAll() });
  const banners = bannersQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['banners', 'all'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.banners.all });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      bannerService.create({
        image_url: form.image_url.trim() || null,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        link: form.link.trim() || '/',
        sort_order: form.sort_order,
        is_active: form.is_active,
      }),
    onSuccess: () => {
      toast.success('Banner created');
      invalidate();
      setIsFormOpen(false);
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not create banner.')),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingBanner) throw new Error('No banner selected.');
      return bannerService.update(editingBanner.id, {
        image_url: form.image_url.trim() || null,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        link: form.link.trim() || '/',
        sort_order: form.sort_order,
        is_active: form.is_active,
      });
    },
    onSuccess: () => {
      toast.success('Banner updated');
      invalidate();
      setIsFormOpen(false);
      setEditingBanner(null);
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not update banner.')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ banner, isActive }: { banner: Banner; isActive: boolean }) => bannerService.update(banner.id, { is_active: isActive }),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not update banner status.')),
  });

  const removeMutation = useMutation({
    mutationFn: (bannerId: string) => bannerService.remove(bannerId),
    onSuccess: () => {
      toast.success('Banner deleted');
      invalidate();
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not delete banner.')),
  });

  const openCreate = () => {
    setEditingBanner(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setForm(bannerToForm(banner));
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (editingBanner) updateMutation.mutate();
    else createMutation.mutate();
  };

  const handleDelete = (banner: Banner) => {
    if (!confirm(`Delete the "${banner.title}" banner? This cannot be undone.`)) return;
    removeMutation.mutate(banner.id);
  };

  const handleImageChange = async (file: File) => {
    if (!user) return;
    if (!isAcceptedImageFile(file)) return toast.error('Only JPG, PNG, or WEBP images are supported.');
    if (file.size > 8 * 1024 * 1024) return toast.error('Image must be smaller than 8MB.');
    setIsUploading(true);
    try {
      const url = await uploadBannerImage(file, user.id);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'Image upload failed.'));
    } finally {
      setIsUploading(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Seo title="Banners" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Banners</h1>
        <Button variant="account" onClick={openCreate}>
          <Plus size={16} /> New Banner
        </Button>
      </div>

      {bannersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No banners yet" description="Use the New Banner button above to create the first homepage banner." />
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <Card key={banner.id} hover={false} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-100 dark:bg-primary-800">
                  {banner.image_url ? <img src={banner.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={18} className="text-primary-300" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-acc-text dark:text-white">{banner.title}</p>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        banner.is_active
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
                      )}
                    >
                      {banner.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="truncate text-sm text-acc-text-secondary">{banner.subtitle}</p>
                  <p className="text-xs text-acc-text-secondary">
                    Links to {banner.link} · Sort order {banner.sort_order}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(banner)}>
                  <Pencil size={14} /> Edit
                </Button>
                <Button
                  size="sm"
                  variant={banner.is_active ? 'danger' : 'account'}
                  onClick={() => toggleActiveMutation.mutate({ banner, isActive: !banner.is_active })}
                  isLoading={toggleActiveMutation.isPending}
                >
                  <Power size={14} /> {banner.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(banner)} isLoading={removeMutation.isPending}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingBanner ? 'Edit Banner' : 'New Banner'}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Image</label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-xl border border-acc-border bg-primary-50 dark:border-primary-700 dark:bg-primary-800">
                {form.image_url ? <img src={form.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={20} className="text-primary-300" />}
              </div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} isLoading={isUploading}>
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageChange(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <Input floating label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input floating label="Subtitle (optional)" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          <Input floating label="Link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <div className="flex gap-3">
            <Input floating label="Sort Order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            <label className="flex w-full items-center justify-between rounded-2xl border border-acc-border px-4 py-3 text-sm dark:border-primary-700">
              <span className="text-acc-text dark:text-white">Active</span>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-acc-primary" />
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="account" fullWidth onClick={handleSubmit} isLoading={isSaving}>
              {editingBanner ? 'Save Changes' : 'Create Banner'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

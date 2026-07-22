import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Tag, Plus, Pencil, Trash2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { bannerService } from '@/services/bannerService';
import type { Banner } from '@/types';

const EMPTY_BANNER: Omit<Banner, 'id'> = { title: '', subtitle: '', image_url: '', link: '/', sort_order: 0, is_active: true };

export function AdminOffersPage() {
  const queryClient = useQueryClient();
  const { data: banners, isLoading } = useQuery({ queryKey: ['admin', 'banners'], queryFn: () => bannerService.listAll() });

  const save = useMutation({
    mutationFn: (banner: Banner) => bannerService.save(banner),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      toast.success('Offer saved');
      setIsModalOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => bannerService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      toast.success('Offer removed');
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Banner>({ id: '', ...EMPTY_BANNER });

  const openAdd = () => {
    setForm({ id: crypto.randomUUID(), ...EMPTY_BANNER, sort_order: (banners?.length ?? 0) });
    setIsModalOpen(true);
  };
  const openEdit = (banner: Banner) => {
    setForm(banner);
    setIsModalOpen(true);
  };

  return (
    <div>
      <Seo title="Admin — Offers" />
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={22} className="text-accent" />
          <h1 className="text-2xl font-bold">Offers</h1>
        </div>
        <Button variant="accent" size="sm" onClick={openAdd}>
          <Plus size={15} /> Add Offer
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-3">
          {(banners ?? []).map((banner) => (
            <div key={banner.id} className="card-surface flex items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{banner.title}</p>
                  <span className={banner.is_active ? 'badge-success' : 'badge-danger'}>{banner.is_active ? 'Active' : 'Paused'}</span>
                </div>
                <p className="text-sm text-primary-400">{banner.subtitle}</p>
                <p className="text-xs text-primary-300">Links to {banner.link}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(banner)} className="rounded-lg p-1.5 hover:bg-primary-100 dark:hover:bg-primary-700">
                  <Pencil size={15} />
                </button>
                <button onClick={() => remove.mutate(banner.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={form.title ? 'Edit Offer' : 'Add Offer'}>
        <div className="space-y-3">
          <Input label="Title" name="offer-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Subtitle" name="offer-subtitle" value={form.subtitle ?? ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          <Input label="Image URL" name="offer-image-url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <Input label="Link" name="offer-link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded" />
            Active
          </label>
          <Button variant="accent" fullWidth onClick={() => save.mutate(form)} isLoading={save.isPending}>
            Save Offer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

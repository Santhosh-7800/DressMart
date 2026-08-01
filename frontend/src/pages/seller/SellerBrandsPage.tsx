import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Star, Tags } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { slugify } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { brandService } from '@/services/productService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import type { Brand } from '@/types';

type BrandFormState = {
  name: string;
  slug: string;
  logo_url: string;
  description: string;
  is_featured: boolean;
};

const EMPTY_FORM: BrandFormState = { name: '', slug: '', logo_url: '', description: '', is_featured: false };

function brandToForm(brand: Brand): BrandFormState {
  return { name: brand.name, slug: brand.slug, logo_url: brand.logo_url ?? '', description: brand.description ?? '', is_featured: brand.is_featured };
}

/** Head-Seller-only brand management — mirrors SellerCategoriesPage's create/edit/delete pattern. */
export function SellerBrandsPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [form, setForm] = useState<BrandFormState>(EMPTY_FORM);

  const brandsQuery = useQuery({ queryKey: queryKeys.brands.all, queryFn: () => brandService.list() });
  const brands = brandsQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.brands.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.brands.featured });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      brandService.create({
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        logo_url: form.logo_url.trim() || null,
        description: form.description.trim() || null,
        is_featured: form.is_featured,
      }),
    onSuccess: () => {
      toast.success('Brand created');
      invalidate();
      setIsFormOpen(false);
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not create brand.')),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingBrand) throw new Error('No brand selected.');
      return brandService.update(editingBrand.id, {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        logo_url: form.logo_url.trim() || null,
        description: form.description.trim() || null,
        is_featured: form.is_featured,
      });
    },
    onSuccess: () => {
      toast.success('Brand updated');
      invalidate();
      setIsFormOpen(false);
      setEditingBrand(null);
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not update brand.')),
  });

  const removeMutation = useMutation({
    mutationFn: (brandId: string) => brandService.remove(brandId),
    onSuccess: () => {
      toast.success('Brand deleted');
      invalidate();
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, 'Could not delete brand.')),
  });

  const openCreate = () => {
    setEditingBrand(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setForm(brandToForm(brand));
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Brand name is required.');
      return;
    }
    if (editingBrand) updateMutation.mutate();
    else createMutation.mutate();
  };

  const handleDelete = (brand: Brand) => {
    if (!confirm(`Delete "${brand.name}"? This cannot be undone.`)) return;
    removeMutation.mutate(brand.id);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Seo title="Brands" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Brands</h1>
        <Button variant="account" onClick={openCreate}>
          <Plus size={16} /> New Brand
        </Button>
      </div>

      {brandsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <EmptyState icon={Tags} title="No brands yet" description="Use the New Brand button above to create your first one." />
      ) : (
        <div className="space-y-3">
          {brands.map((brand) => (
            <Card key={brand.id} hover={false} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-acc-text dark:text-white">{brand.name}</p>
                  {brand.is_featured && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <Star size={11} fill="currentColor" /> Featured
                    </span>
                  )}
                </div>
                <p className="text-xs text-acc-text-secondary">/{brand.slug}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(brand)}>
                  <Pencil size={14} /> Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(brand)} isLoading={removeMutation.isPending}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingBrand ? 'Edit Brand' : 'New Brand'}>
        <div className="space-y-4">
          <Input
            floating
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, slug: editingBrand ? form.slug : slugify(e.target.value) })}
          />
          <Input floating label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Input floating label="Logo URL (optional)" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Description (optional)</label>
            <textarea className="input-field min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="h-4 w-4 rounded" />
            Featured brand
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="account" fullWidth onClick={handleSubmit} isLoading={isSaving}>
              {editingBrand ? 'Save Changes' : 'Create Brand'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

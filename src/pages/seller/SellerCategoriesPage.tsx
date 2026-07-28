import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { slugify } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { categoryService } from '@/services/productService';
import type { Category, Gender } from '@/types';

type CategoryFormState = {
  name: string;
  slug: string;
  gender: Gender;
  parent_id: string | null;
  sort_order: number;
  image_url: string;
};

const EMPTY_FORM: CategoryFormState = { name: '', slug: '', gender: 'men', parent_id: null, sort_order: 0, image_url: '' };

function categoryToForm(category: Category): CategoryFormState {
  return {
    name: category.name,
    slug: category.slug,
    gender: category.gender,
    parent_id: category.parent_id,
    sort_order: category.sort_order,
    image_url: category.image_url ?? '',
  };
}

export function SellerCategoriesPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);

  const categoriesQuery = useQuery({ queryKey: queryKeys.categories.all, queryFn: () => categoryService.list() });
  const categories = categoriesQuery.data ?? [];
  const topLevelForGender = categories.filter((c) => !c.parent_id && c.gender === form.gender);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });

  const createMutation = useMutation({
    mutationFn: () =>
      categoryService.create({
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        gender: form.gender,
        parent_id: form.parent_id,
        sort_order: form.sort_order,
        image_url: form.image_url.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Category created');
      invalidate();
      setIsFormOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not create category.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingCategory) throw new Error('No category selected.');
      return categoryService.update(editingCategory.id, {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        gender: form.gender,
        parent_id: form.parent_id,
        sort_order: form.sort_order,
        image_url: form.image_url.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success('Category updated');
      invalidate();
      setIsFormOpen(false);
      setEditingCategory(null);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not update category.'),
  });

  const removeMutation = useMutation({
    mutationFn: (categoryId: string) => categoryService.remove(categoryId),
    onSuccess: () => {
      toast.success('Category deleted');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Could not delete category.'),
  });

  const openCreate = () => {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setForm(categoryToForm(category));
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Category name is required.');
      return;
    }
    if (editingCategory) updateMutation.mutate();
    else createMutation.mutate();
  };

  const handleDelete = (category: Category) => {
    if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    removeMutation.mutate(category.id);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Seo title="Categories" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Categories</h1>
        <Button variant="account" onClick={openCreate}>
          <Plus size={16} /> New Category
        </Button>
      </div>

      {categoriesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Use the New Category button above to create your first one." />
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <Card key={category.id} hover={false} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-acc-text dark:text-white">{category.name}</p>
                  <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-primary-600 dark:bg-primary-800 dark:text-primary-300">
                    {category.gender}
                  </span>
                </div>
                <p className="text-xs text-acc-text-secondary">
                  /{category.slug} {category.parent_id && `· sub-category of ${categories.find((c) => c.id === category.parent_id)?.name ?? category.parent_id}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(category)}>
                  <Pencil size={14} /> Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(category)} isLoading={removeMutation.isPending}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingCategory ? 'Edit Category' : 'New Category'}>
        <div className="space-y-4">
          <Input
            floating
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value, slug: editingCategory ? form.slug : slugify(e.target.value) })}
          />
          <Input floating label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <div className="flex gap-3">
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as Gender, parent_id: null })}
                className="input-field"
              >
                <option value="men">Men</option>
                <option value="kids">Kids</option>
              </select>
            </div>
            <Input floating label="Sort Order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Parent Category</label>
            <select value={form.parent_id ?? ''} onChange={(e) => setForm({ ...form, parent_id: e.target.value || null })} className="input-field">
              <option value="">None (top-level)</option>
              {topLevelForGender
                .filter((c) => c.id !== editingCategory?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <Input floating label="Image URL (optional)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="account" fullWidth onClick={handleSubmit} isLoading={isSaving}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

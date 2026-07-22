import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { categoryService } from '@/services/productService';
import { adminCategoryService, type CategoryInput } from '@/services/adminCategoryService';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queryClient';
import type { Category, Gender } from '@/types';

const EMPTY: CategoryInput = { name: '', gender: 'men', sort_order: 0 };

export function AdminCategoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useQuery({ queryKey: ['admin', 'categories', 'all'], queryFn: () => categoryService.list() });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  };

  const saveCategory = useMutation({
    mutationFn: (input: CategoryInput) => adminCategoryService.save(input),
    onSuccess: () => {
      invalidateAll();
      toast.success('Category saved');
      setIsModalOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeCategory = useMutation({
    mutationFn: (categoryId: string) => adminCategoryService.remove(categoryId),
    onSuccess: () => {
      invalidateAll();
      toast.success('Category deleted');
      closeDeleteFlow();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moveAndDelete = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => adminCategoryService.moveProductsAndDelete(from, to),
    onSuccess: () => {
      invalidateAll();
      toast.success('Products moved and category deleted');
      closeDeleteFlow();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const forceDelete = useMutation({
    mutationFn: (categoryId: string) => adminCategoryService.forceDeleteWithProducts(categoryId),
    onSuccess: () => {
      invalidateAll();
      toast.success('Category and its products were deleted');
      closeDeleteFlow();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<CategoryInput>(EMPTY);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState('');

  const { data: productCount, isLoading: isLoadingProductCount } = useQuery({
    queryKey: ['admin', 'categories', 'product-count', deleteTarget?.id],
    queryFn: () => adminCategoryService.getProductCount(deleteTarget!.id),
    enabled: Boolean(deleteTarget),
  });

  const subcategories = (categories ?? []).filter((c) => c.parent_id);
  const menCategories = subcategories.filter((c) => c.gender === 'men');
  const kidsCategories = subcategories.filter((c) => c.gender === 'kids');

  const moveTargetOptions = subcategories.filter((c) => c.id !== deleteTarget?.id && c.gender === deleteTarget?.gender);

  const openAdd = (gender: Gender) => {
    setForm({ ...EMPTY, gender, sort_order: subcategories.length + 2 });
    setIsModalOpen(true);
  };

  const openEdit = (id: string, name: string, gender: Gender, sort_order: number) => {
    setForm({ id, name, gender, sort_order });
    setIsModalOpen(true);
  };

  const openDelete = (category: Category) => {
    setDeleteTarget(category);
    setIsMoveMode(false);
    setMoveTargetId('');
  };

  const closeDeleteFlow = () => {
    setDeleteTarget(null);
    setIsMoveMode(false);
    setMoveTargetId('');
  };

  const renderGroup = (title: string, gender: Gender, items: typeof subcategories) => (
    <div className="card-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Button variant="accent" size="sm" onClick={() => openAdd(gender)}>
          <Plus size={14} /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-admin-border px-4 py-3 text-sm transition-all duration-200 hover:border-admin-orange/30 hover:bg-admin-orange/5"
          >
            <span className="font-medium text-admin-text">{c.name}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openEdit(c.id, c.name, c.gender, c.sort_order)}
                className="rounded-xl p-2 text-admin-orange transition-all duration-200 hover:scale-105 hover:bg-admin-orange/10 active:scale-95"
                aria-label={`Edit ${c.name}`}
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => openDelete(c)}
                className="rounded-xl p-2 text-red-600 transition-all duration-200 hover:scale-105 hover:bg-red-50 active:scale-95"
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="py-4 text-center text-sm text-admin-text-secondary">No sub categories yet.</p>}
      </div>
    </div>
  );

  return (
    <div>
      <Seo title="Admin — Categories" />
      <div className="mb-5 flex items-center gap-2">
        <FolderTree size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Categories</h1>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {renderGroup('Men', 'men', menCategories)}
          {renderGroup('Kids', 'kids', kidsCategories)}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={form.id ? 'Edit Category' : 'Add Category'}>
        <div className="space-y-3">
          <Input label="Name" name="category-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div>
            <p className="mb-1.5 text-sm font-medium">Section</p>
            <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}>
              <option value="men">Men</option>
              <option value="kids">Kids</option>
            </select>
          </div>
          <Button variant="accent" fullWidth onClick={() => saveCategory.mutate(form)} isLoading={saveCategory.isPending}>
            Save Category
          </Button>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={closeDeleteFlow} title="Delete Category?">
        {isLoadingProductCount ? (
          <Skeleton className="h-20 w-full" />
        ) : productCount === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-primary-500">Are you sure you want to delete this category?</p>
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={closeDeleteFlow}>
                Cancel
              </Button>
              <Button variant="danger" fullWidth onClick={() => deleteTarget && removeCategory.mutate(deleteTarget.id)} isLoading={removeCategory.isPending}>
                Delete
              </Button>
            </div>
          </div>
        ) : !isMoveMode ? (
          <div className="space-y-4">
            <p className="text-sm text-primary-500">
              This category contains products. Move the products to another category or delete the products first.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" fullWidth onClick={() => setIsMoveMode(true)}>
                Move Products
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => {
                    if (deleteTarget && confirm('This will permanently delete every product in this category. Continue?')) {
                      forceDelete.mutate(deleteTarget.id);
                    }
                  }}
                  isLoading={forceDelete.isPending}
                >
                  Delete Anyway (Admin only)
                </Button>
              )}
              <Button variant="ghost" fullWidth onClick={closeDeleteFlow}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-primary-500">
              Move all {productCount} product{productCount === 1 ? '' : 's'} to:
            </p>
            <select className="input-field" value={moveTargetId} onChange={(e) => setMoveTargetId(e.target.value)}>
              <option value="">Select a category</option>
              {moveTargetOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={() => setIsMoveMode(false)}>
                Back
              </Button>
              <Button
                variant="accent"
                fullWidth
                disabled={!moveTargetId}
                isLoading={moveAndDelete.isPending}
                onClick={() => deleteTarget && moveAndDelete.mutate({ from: deleteTarget.id, to: moveTargetId })}
              >
                Move &amp; Delete Category
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

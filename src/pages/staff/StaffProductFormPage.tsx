import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UploadCloud, X, Plus, Star } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffProduct, useCreateStaffProduct, useUpdateStaffProduct } from '@/hooks/useStaffProducts';
import { brandService, categoryService } from '@/services/productService';
import { staffService } from '@/services/staffService';
import type { StaffContext } from '@/services/staffProductService';
import { uploadProductImage, isAcceptedImageFile } from '@/services/storageService';
import { SIZE_SETS, MATERIALS } from '@/data/catalogSource';
import { cn } from '@/lib/utils';
import type { StaffProductInput, Gender } from '@/types';

const EMPTY_FORM: StaffProductInput = {
  name: '',
  sku: '',
  brand_id: '',
  category_id: '',
  gender: 'men',
  description: '',
  price: 0,
  mrp: 0,
  material: '',
  specifications: '',
  sizes: [],
  colors: [],
  stock_quantity: 0,
  images: [],
  tags: [],
  is_active: true,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-admin-text">{label}</span>
      {children}
    </label>
  );
}

export function StaffProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: existingProduct, isLoading: isLoadingProduct } = useStaffProduct(id, user?.id);
  const { data: brands } = useQuery({ queryKey: ['staff', 'brands'], queryFn: () => brandService.list() });
  const { data: categories } = useQuery({ queryKey: ['staff', 'categories'], queryFn: () => categoryService.list() });
  const { data: staffDetails } = useQuery({ queryKey: ['staff', 'details', user?.id], queryFn: () => staffService.getDetails(user!.id), enabled: Boolean(user?.id) });
  const staffContext: StaffContext | undefined = user && staffDetails
    ? { id: user.id, name: user.full_name, employeeId: staffDetails.employee_id, department: staffDetails.department, shopName: staffDetails.shop_name }
    : undefined;
  const createProduct = useCreateStaffProduct(staffContext);
  const updateProduct = useUpdateStaffProduct(staffContext);

  const [form, setForm] = useState<StaffProductInput>(EMPTY_FORM);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#6b7280');
  const [customSize, setCustomSize] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    if (isEditing && !isLoadingProduct && existingProduct === null) {
      toast.error('That product was not found, or is not one of yours to edit.');
      navigate('/staff/products', { replace: true });
    }
  }, [isEditing, isLoadingProduct, existingProduct, navigate]);

  useEffect(() => {
    if (existingProduct) {
      setForm({
        id: existingProduct.id,
        name: existingProduct.name,
        sku: existingProduct.sku,
        brand_id: existingProduct.brand_id,
        category_id: existingProduct.category_id,
        gender: existingProduct.gender,
        description: existingProduct.description,
        price: existingProduct.price,
        mrp: existingProduct.mrp,
        material: existingProduct.specifications.material,
        specifications: existingProduct.specifications.other_specs ?? '',
        sizes: [...new Set(existingProduct.variants.map((v) => v.size))],
        colors: [...new Map(existingProduct.variants.map((v) => [v.color, { name: v.color, hex: v.color_hex }])).values()],
        stock_quantity: existingProduct.total_stock,
        images: existingProduct.galleryImages ?? existingProduct.images.map((i) => i.url),
        tags: existingProduct.tags,
        is_active: existingProduct.is_active,
      });
    }
  }, [existingProduct]);

  const categoriesForGender = (categories ?? []).filter((c) => c.gender === form.gender && c.parent_id);
  const discountPercent = form.mrp > 0 ? Math.max(0, Math.round(((form.mrp - form.price) / form.mrp) * 100)) : 0;

  const toggleSize = (size: string) => {
    setForm((prev) => ({ ...prev, sizes: prev.sizes.includes(size) ? prev.sizes.filter((s) => s !== size) : [...prev.sizes, size] }));
  };

  const addCustomSize = () => {
    const size = customSize.trim();
    if (!size || form.sizes.includes(size)) return;
    setForm((prev) => ({ ...prev, sizes: [...prev.sizes, size] }));
    setCustomSize('');
  };

  const addColor = () => {
    const name = newColorName.trim();
    if (!name || form.colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    setForm((prev) => ({ ...prev, colors: [...prev.colors, { name, hex: newColorHex }] }));
    setNewColorName('');
  };

  const removeColor = (name: string) => {
    setForm((prev) => ({ ...prev, colors: prev.colors.filter((c) => c.name !== name) }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || form.tags.includes(tag)) return;
    setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleFiles = async (files: FileList | File[]) => {
    const accepted = [...files].filter(isAcceptedImageFile);
    if (accepted.length === 0) {
      toast.error('Only JPG, PNG, or WEBP images are supported');
      return;
    }
    setIsUploading(true);
    try {
      const urls = await Promise.all(accepted.map(uploadProductImage));
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Image upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (url: string) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((i) => i !== url) }));
  };

  const setThumbnail = (url: string) => {
    setForm((prev) => ({ ...prev, images: [url, ...prev.images.filter((i) => i !== url)] }));
  };

  // A draft is a work-in-progress, so it only needs a name — full validation applies once staff
  // actually submits it for Admin's review.
  const handleSubmit = async (targetStatus: 'draft' | 'pending') => {
    if (!form.name) {
      toast.error('Give the product a name first');
      return;
    }
    if (targetStatus === 'pending') {
      if (!form.sku || !form.brand_id || !form.category_id) {
        toast.error('SKU, Brand, and Category are required to submit for approval');
        return;
      }
      if (form.sizes.length === 0 || form.colors.length === 0) {
        toast.error('Add at least one size and one color');
        return;
      }
      if (form.images.length === 0) {
        toast.error('Add at least one product image');
        return;
      }
    }
    if (isEditing) {
      await updateProduct.mutateAsync({ input: form, status: targetStatus });
    } else {
      await createProduct.mutateAsync({ input: form, status: targetStatus });
    }
    navigate('/staff/products');
  };

  if (isEditing && isLoadingProduct) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Seo title={isEditing ? 'Edit Product' : 'Add Product'} />
      <h1 className="mb-6 text-2xl font-bold text-admin-text">{isEditing ? 'Edit Product' : 'Add Product'}</h1>
      {isEditing && existingProduct?.approval_status !== 'draft' && (
        <div className="admin-badge-warning mb-6 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">Saving resubmits for approval</div>
      )}

      <div className="space-y-6">
        {/* Images */}
        <section className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-admin-text">Multiple Images &amp; Thumbnail</h2>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200',
              isDraggingOver ? 'scale-[1.01] border-admin-orange bg-admin-orange/5 shadow-card' : 'border-admin-border hover:border-admin-orange/50 hover:bg-admin-orange/5',
            )}
          >
            <UploadCloud size={28} className="text-admin-text-secondary transition-transform duration-200" />
            <p className="text-sm text-admin-text-secondary">Drag &amp; drop images here, or click to browse</p>
            <p className="text-xs text-admin-text-secondary">JPG, PNG, or WEBP · first image is the thumbnail</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
          {isUploading && <p className="mt-2 text-xs text-admin-text-secondary">Uploading…</p>}
          {form.images.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {form.images.map((url, idx) => (
                <div key={url} className="group relative">
                  <img
                    src={url}
                    alt=""
                    className={cn('h-20 w-20 rounded-xl object-cover shadow-sm ring-1 transition-transform duration-200 group-hover:scale-105', idx === 0 ? 'ring-2 ring-admin-orange' : 'ring-admin-border')}
                    loading="lazy"
                  />
                  {idx === 0 && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-admin-orange px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">Thumbnail</span>
                  )}
                  {idx !== 0 && (
                    <button
                      onClick={() => setThumbnail(url)}
                      className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-admin-navy text-white opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100"
                      aria-label="Set as thumbnail"
                      title="Set as thumbnail"
                    >
                      <Star size={11} />
                    </button>
                  )}
                  <button
                    onClick={() => removeImage(url)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-admin-navy text-white shadow-sm transition-transform duration-200 hover:scale-110"
                    aria-label="Remove image"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Basic info */}
        <section className="card-surface grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h2 className="col-span-full font-semibold text-admin-text">Product Details</h2>
          <Field label="Product Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="SKU">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label="Brand">
            <select className="input-field" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
              <option value="">Select brand</option>
              {(brands ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender, category_id: '' })}>
              <option value="men">Men</option>
              <option value="kids">Kids</option>
            </select>
          </Field>
          <Field label="Sub Category">
            <select className="input-field" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Select sub category</option>
              {categoriesForGender.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Material">
            <Input list="materials" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
            <datalist id="materials">
              {MATERIALS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <div className="col-span-full">
            <Field label="Description">
              <textarea className="input-field min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-full">
            <Field label="Specifications">
              <textarea
                className="input-field min-h-20"
                placeholder="Fabric weight, care instructions, pattern, occasion, etc."
                value={form.specifications}
                onChange={(e) => setForm({ ...form, specifications: e.target.value })}
              />
            </Field>
          </div>
        </section>

        {/* Pricing */}
        <section className="card-surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
          <h2 className="col-span-full font-semibold text-admin-text">Pricing</h2>
          <Field label="Price (₹)">
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </Field>
          <Field label="MRP (₹)">
            <Input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })} />
          </Field>
          <Field label="Discount">
            <div className="input-field flex items-center bg-admin-bg text-admin-text-secondary">{discountPercent}%</div>
          </Field>
        </section>

        {/* Variants */}
        <section className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-admin-text">Available Sizes</h2>
          <div className="flex flex-wrap gap-2">
            {SIZE_SETS.apparel.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className={cn('rounded-lg border px-3 py-1.5 text-sm', form.sizes.includes(size) ? 'border-admin-orange bg-admin-orange/10 text-admin-orange' : 'border-admin-border text-admin-text')}
              >
                {size}
              </button>
            ))}
            {form.sizes.filter((s) => !SIZE_SETS.apparel.includes(s)).map((size) => (
              <button key={size} type="button" onClick={() => toggleSize(size)} className="rounded-lg border border-admin-orange bg-admin-orange/10 px-3 py-1.5 text-sm text-admin-orange">
                {size}
              </button>
            ))}
          </div>
          <div className="mt-2 flex max-w-xs gap-2">
            <Input placeholder="Custom size (e.g. 32, One Size)" value={customSize} onChange={(e) => setCustomSize(e.target.value)} className="text-sm" />
            <Button variant="outline" size="sm" onClick={addCustomSize} type="button">
              <Plus size={14} />
            </Button>
          </div>

          <h2 className="mb-3 mt-6 font-semibold text-admin-text">Available Colors</h2>
          <div className="flex flex-wrap gap-2">
            {form.colors.map((color) => (
              <span key={color.name} className="flex items-center gap-1.5 rounded-full border border-admin-border py-1 pl-1 pr-2.5 text-sm text-admin-text">
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                {color.name}
                <button onClick={() => removeColor(color.name)} aria-label={`Remove ${color.name}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex max-w-sm items-center gap-2">
            <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-admin-border" />
            <Input placeholder="Color name" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} className="text-sm" />
            <Button variant="outline" size="sm" onClick={addColor} type="button">
              <Plus size={14} />
            </Button>
          </div>
        </section>

        {/* Inventory */}
        <section className="card-surface grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h2 className="col-span-full font-semibold text-admin-text">Inventory</h2>
          <Field label="Stock Quantity (total, split evenly across size/color)">
            <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} />
          </Field>
        </section>

        {/* Tags & visibility */}
        <section className="card-surface p-5">
          <h2 className="mb-3 font-semibold text-admin-text">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {form.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1.5 rounded-full border border-admin-border bg-admin-bg py-1 pl-3 pr-2 text-sm text-admin-text">
                {tag}
                <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex max-w-sm gap-2">
            <Input
              placeholder="e.g. summer, casual"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={addTag} type="button">
              <Plus size={14} />
            </Button>
          </div>

          <h2 className="mb-3 mt-6 font-semibold text-admin-text">Visibility</h2>
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded" />
            Publish once approved (uncheck to keep as a hidden draft even after Admin approves it)
          </label>
        </section>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/staff/products')}>
            Cancel
          </Button>
          {(!isEditing || existingProduct?.approval_status === 'draft') && (
            <Button variant="outline" onClick={() => handleSubmit('draft')} isLoading={createProduct.isPending || updateProduct.isPending}>
              Save as Draft
            </Button>
          )}
          <Button variant="accent" onClick={() => handleSubmit('pending')} isLoading={createProduct.isPending || updateProduct.isPending}>
            {isEditing && existingProduct?.approval_status !== 'draft' ? 'Save & Resubmit' : 'Submit for Approval'}
          </Button>
        </div>
      </div>
    </div>
  );
}

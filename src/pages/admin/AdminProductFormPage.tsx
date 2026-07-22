import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UploadCloud, X, Plus } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAdminProduct, useSaveProduct } from '@/hooks/useAdminProducts';
import { brandService, categoryService } from '@/services/productService';
import { uploadProductImage, isAcceptedImageFile } from '@/services/storageService';
import { SIZE_SETS, MATERIALS, FITS } from '@/data/catalogSource';
import { cn } from '@/lib/utils';
import type { AdminProductInput, Gender } from '@/types';

const EMPTY_FORM: AdminProductInput = {
  name: '',
  sku: '',
  brand_id: '',
  category_id: '',
  gender: 'men',
  description: '',
  price: 0,
  mrp: 0,
  gst_percent: 5,
  material: '',
  fit: '',
  sleeve: '',
  collar: '',
  sizes: [],
  colors: [],
  stock_quantity: 0,
  low_stock_threshold: 5,
  images: [],
  is_active: true,
  is_featured: false,
  is_trending: false,
  is_bestseller: false,
  is_new_arrival: false,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">{label}</span>
      {children}
    </label>
  );
}

export function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const { data: existingProduct, isLoading: isLoadingProduct } = useAdminProduct(id);
  const { data: brands } = useQuery({ queryKey: ['admin', 'brands'], queryFn: () => brandService.list() });
  const { data: categories } = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => categoryService.list() });
  const saveProduct = useSaveProduct();

  const [form, setForm] = useState<AdminProductInput>(EMPTY_FORM);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#6b7280');
  const [customSize, setCustomSize] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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
        gst_percent: existingProduct.gst_percent,
        material: existingProduct.specifications.material,
        fit: existingProduct.specifications.fit,
        sleeve: existingProduct.specifications.sleeve ?? '',
        collar: existingProduct.specifications.neck ?? '',
        sizes: [...new Set(existingProduct.variants.map((v) => v.size))],
        colors: [...new Map(existingProduct.variants.map((v) => [v.color, { name: v.color, hex: v.color_hex }])).values()],
        stock_quantity: existingProduct.total_stock,
        low_stock_threshold: existingProduct.low_stock_threshold,
        images: existingProduct.galleryImages ?? existingProduct.images.map((i) => i.url),
        is_active: existingProduct.is_active,
        is_featured: existingProduct.is_featured,
        is_trending: existingProduct.is_trending,
        is_bestseller: existingProduct.is_bestseller,
        is_new_arrival: existingProduct.is_new_arrival,
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

  const handleSubmit = async () => {
    if (!form.name || !form.sku || !form.brand_id || !form.category_id) {
      toast.error('Name, SKU, Brand, and Category are required');
      return;
    }
    if (form.sizes.length === 0 || form.colors.length === 0) {
      toast.error('Add at least one size and one color');
      return;
    }
    await saveProduct.mutateAsync(form);
    navigate('/admin/products');
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
      <h1 className="mb-6 text-2xl font-bold">{isEditing ? 'Edit Product' : 'Add Product'}</h1>

      <div className="space-y-6">
        {/* Images */}
        <section className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Images</h2>
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
              isDraggingOver
                ? 'scale-[1.01] border-accent bg-accent-50 shadow-card dark:bg-accent-900/20'
                : 'border-primary-200 hover:border-primary-300 hover:bg-primary-50 dark:border-primary-600 dark:hover:bg-primary-800',
            )}
          >
            <UploadCloud size={28} className="text-primary-400 transition-transform duration-200" />
            <p className="text-sm text-primary-500">Drag &amp; drop images here, or click to browse</p>
            <p className="text-xs text-primary-300">JPG, PNG, or WEBP</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
          {isUploading && <p className="mt-2 text-xs text-primary-400">Uploading…</p>}
          {form.images.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {form.images.map((url) => (
                <div key={url} className="group relative">
                  <img
                    src={url}
                    alt=""
                    className="h-20 w-20 rounded-xl object-cover shadow-sm ring-1 ring-primary-100 transition-transform duration-200 group-hover:scale-105 dark:ring-primary-700"
                    loading="lazy"
                  />
                  <button
                    onClick={() => removeImage(url)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-900 text-white shadow-sm transition-transform duration-200 hover:scale-110"
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
          <h2 className="col-span-full font-semibold">Product Details</h2>
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
            <select
              className="input-field"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as Gender, category_id: '' })}
            >
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
        </section>

        {/* Pricing */}
        <section className="card-surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <h2 className="col-span-full font-semibold">Pricing</h2>
          <Field label="Price (₹)">
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </Field>
          <Field label="MRP (₹)">
            <Input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })} />
          </Field>
          <Field label="Discount">
            <div className="input-field flex items-center bg-primary-50 text-primary-500 dark:bg-primary-800">{discountPercent}%</div>
          </Field>
          <Field label="GST (%)">
            <Input type="number" value={form.gst_percent} onChange={(e) => setForm({ ...form, gst_percent: Number(e.target.value) })} />
          </Field>
        </section>

        {/* Variants */}
        <section className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Available Sizes</h2>
          <div className="flex flex-wrap gap-2">
            {SIZE_SETS.apparel.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className={cn('rounded-lg border px-3 py-1.5 text-sm', form.sizes.includes(size) ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/30' : 'border-primary-200 dark:border-primary-600')}
              >
                {size}
              </button>
            ))}
            {form.sizes.filter((s) => !SIZE_SETS.apparel.includes(s)).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className="rounded-lg border border-accent bg-accent-50 px-3 py-1.5 text-sm text-accent-700 dark:bg-accent-900/30"
              >
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

          <h2 className="mb-3 mt-6 font-semibold">Available Colors</h2>
          <div className="flex flex-wrap gap-2">
            {form.colors.map((color) => (
              <span key={color.name} className="flex items-center gap-1.5 rounded-full border border-primary-200 py-1 pl-1 pr-2.5 text-sm dark:border-primary-600">
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                {color.name}
                <button onClick={() => removeColor(color.name)} aria-label={`Remove ${color.name}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex max-w-sm items-center gap-2">
            <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-primary-200" />
            <Input placeholder="Color name" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} className="text-sm" />
            <Button variant="outline" size="sm" onClick={addColor} type="button">
              <Plus size={14} />
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Fit">
              <Input list="fits" value={form.fit} onChange={(e) => setForm({ ...form, fit: e.target.value })} />
              <datalist id="fits">
                {FITS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </Field>
            <Field label="Sleeve">
              <Input value={form.sleeve} onChange={(e) => setForm({ ...form, sleeve: e.target.value })} placeholder="Full Sleeve, Half Sleeve..." />
            </Field>
            <Field label="Collar">
              <Input value={form.collar} onChange={(e) => setForm({ ...form, collar: e.target.value })} placeholder="Spread Collar, Round Neck..." />
            </Field>
          </div>
        </section>

        {/* Inventory */}
        <section className="card-surface grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h2 className="col-span-full font-semibold">Inventory</h2>
          <Field label="Stock Quantity (total, split evenly across size/color)">
            <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} />
          </Field>
          <Field label="Minimum Stock Alert">
            <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
          </Field>
        </section>

        {/* Status */}
        <section className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Product Status</h2>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded" />
              Published (visible to customers)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="h-4 w-4 rounded" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_trending} onChange={(e) => setForm({ ...form, is_trending: e.target.checked })} className="h-4 w-4 rounded" />
              Trending
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_bestseller} onChange={(e) => setForm({ ...form, is_bestseller: e.target.checked })} className="h-4 w-4 rounded" />
              Best Seller
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_new_arrival} onChange={(e) => setForm({ ...form, is_new_arrival: e.target.checked })} className="h-4 w-4 rounded" />
              New Arrival
            </label>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/admin/products')}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleSubmit} isLoading={saveProduct.isPending}>
            Save Product
          </Button>
        </div>
      </div>
    </div>
  );
}

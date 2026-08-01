import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UploadCloud, X, Plus, GripVertical, Wand2, ShieldAlert } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerProduct, useCreateProduct, useUpdateProduct } from '@/hooks/useSellerProducts';
import { useInventory } from '@/hooks/useInventory';
import { useStaffPermissions } from '@/hooks/useStaff';
import { brandService, categoryService, toColorInputs } from '@/services/productService';
import { uploadProductImages, isAcceptedImageFile } from '@/services/storageService';
import { MATERIALS, FITS, PATTERNS, OCCASIONS, COLOR_PALETTE } from '@/data/catalogSource';
import { cn, calculateDiscount, generateSku } from '@/lib/utils';
import { effectiveSellerId, isHeadSeller, isStaffRole } from '@/lib/roles';
import type { Gender, ProductStatus, SellerProductColorInput, SellerProductInput } from '@/types';

/**
 * Fixed size grid the seller checks/fills per color — matches the spec's explicit XS..XXXL list.
 * A size only becomes a real variant when it has a `sizeStock` entry (checked box) — unchecked
 * sizes are simply omitted, never forced to exist with a 0 stock entry.
 */
const FIXED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const SLEEVE_OPTIONS = ['Full Sleeve', 'Half Sleeve', '3/4 Sleeve', 'Sleeveless', 'Raglan Sleeve'];
const COLLAR_OPTIONS = ['Round Neck', 'V-Neck', 'Collar', 'Mandarin Collar', 'Polo Collar', 'Hooded', 'Crew Neck'];
const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'hidden', label: 'Hidden' },
];

const MAX_IMAGES = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface ColorImageItem {
  id: string;
  url: string;
  /** Present only for a newly-added, not-yet-uploaded image — uploaded to Storage on submit. */
  file?: File;
}

interface ColorFormState {
  name: string;
  hex: string;
  images: ColorImageItem[];
  sizeStock: Record<string, number>;
}

interface FormState {
  name: string;
  sku: string;
  brand_id: string;
  category_id: string;
  subcategory: string;
  gender: Gender;
  description: string;
  fabric: string;
  sleeve: string;
  fit: string;
  pattern: string;
  collar: string;
  occasion: string;
  price: number;
  mrp: number;
  gst_percent: number;
  cod_available: boolean;
  low_stock_threshold: number;
  colors: ColorFormState[];
  is_return_eligible: boolean;
  is_exchange_eligible: boolean;
  status: ProductStatus;
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  brand_id: '',
  category_id: '',
  subcategory: '',
  gender: 'men',
  description: '',
  fabric: '',
  sleeve: '',
  fit: '',
  pattern: '',
  collar: '',
  occasion: '',
  price: 0,
  mrp: 0,
  gst_percent: 5,
  cod_available: true,
  low_stock_threshold: 5,
  colors: [],
  is_return_eligible: true,
  is_exchange_eligible: true,
  status: 'draft',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** One repeatable color row: name/hex, its own scoped image gallery, and its own per-size stock grid. */
function ColorCard({
  color,
  index,
  canRemove,
  remainingImageSlots,
  onChange,
  onRemove,
}: {
  color: ColorFormState;
  index: number;
  canRemove: boolean;
  remainingImageSlots: number;
  onChange: (patch: Partial<ColorFormState>) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragImageIndex = useRef<number | null>(null);

  const handleFiles = (files: FileList | File[]) => {
    const list = [...files];
    const accepted: File[] = [];
    list.forEach((file) => {
      if (!isAcceptedImageFile(file)) {
        toast.error(`"${file.name}" isn't a supported image type — use JPG, PNG, or WEBP.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`"${file.name}" is larger than 5MB.`);
        return;
      }
      accepted.push(file);
    });
    if (accepted.length === 0) return;
    if (remainingImageSlots <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed across all colors.`);
      return;
    }
    const toAdd = accepted.slice(0, remainingImageSlots);
    if (toAdd.length < accepted.length) {
      toast.error(`Only ${toAdd.length} image(s) added — the ${MAX_IMAGES}-image limit was reached.`);
    }
    const items: ColorImageItem[] = toAdd.map((file) => ({ id: newId(), url: URL.createObjectURL(file), file }));
    onChange({ images: [...color.images, ...items] });
  };

  const removeImage = (imageId: string) => {
    const target = color.images.find((img) => img.id === imageId);
    if (target?.file) URL.revokeObjectURL(target.url);
    onChange({ images: color.images.filter((img) => img.id !== imageId) });
  };

  const reorder = (targetIndex: number) => {
    const from = dragImageIndex.current;
    dragImageIndex.current = null;
    if (from === null || from === targetIndex) return;
    const images = [...color.images];
    const [moved] = images.splice(from, 1);
    images.splice(targetIndex, 0, moved);
    onChange({ images });
  };

  const toggleSize = (size: string) => {
    const next = { ...color.sizeStock };
    if (size in next) delete next[size];
    else next[size] = 1;
    onChange({ sizeStock: next });
  };

  const setSizeQty = (size: string, qty: number) => {
    onChange({ sizeStock: { ...color.sizeStock, [size]: Math.max(0, Math.round(qty) || 0) } });
  };

  return (
    <div className="rounded-2xl border border-primary-200 p-4 dark:border-primary-700">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Field label="Color Name" required>
            <Input value={color.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Navy Blue" className="w-full sm:w-44" />
          </Field>
          <Field label="Color Code">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color.hex) ? color.hex : '#6b7280'}
                onChange={(e) => onChange({ hex: e.target.value })}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-primary-200 dark:border-primary-600"
              />
              <Input value={color.hex} onChange={(e) => onChange({ hex: e.target.value })} className="w-full flex-1 text-sm sm:w-28" />
            </div>
          </Field>
          <Field label="Quick Pick">
            <select
              className="input-field w-full sm:w-40"
              value=""
              onChange={(e) => {
                const preset = COLOR_PALETTE.find((c) => c.name === e.target.value);
                if (preset) onChange({ name: preset.name, hex: preset.hex });
              }}
            >
              <option value="">Choose…</option>
              {COLOR_PALETTE.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <X size={14} /> Remove color
          </button>
        )}
      </div>

      {/* Image gallery scoped to this color */}
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
          'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200',
          isDraggingOver
            ? 'scale-[1.01] border-accent bg-accent-50 shadow-card dark:bg-accent-900/20'
            : 'border-primary-200 hover:border-primary-300 hover:bg-primary-50 dark:border-primary-600 dark:hover:bg-primary-800',
        )}
      >
        <UploadCloud size={22} className="text-primary-400" />
        <p className="text-xs text-primary-500">Drag &amp; drop images for this color, or click to browse</p>
        <p className="text-[11px] text-primary-300">JPG, PNG, or WEBP · max 5MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {color.images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {color.images.map((img, imgIdx) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => {
                dragImageIndex.current = imgIdx;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(imgIdx)}
              className="group relative cursor-grab active:cursor-grabbing"
            >
              <img
                src={img.url}
                alt=""
                className="h-20 w-20 rounded-xl object-cover shadow-sm ring-1 ring-primary-100 transition-transform duration-200 group-hover:scale-105 dark:ring-primary-700"
              />
              {index === 0 && imgIdx === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-primary-900/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">COVER</span>
              )}
              <span className="absolute left-1 top-1 rounded-full bg-white/90 p-0.5 text-primary-500 shadow-sm dark:bg-primary-900/80">
                <GripVertical size={11} />
              </span>
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-900 text-white shadow-sm transition-transform duration-200 hover:scale-110"
                aria-label="Remove image"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Per-size stock grid for this color */}
      <div className="mt-4">
        <span className="mb-1.5 block text-sm font-medium text-primary-800 dark:text-primary-100">Sizes &amp; Stock</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {FIXED_SIZES.map((size) => {
            const checked = size in color.sizeStock;
            return (
              <div
                key={size}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-2 text-sm',
                  checked ? 'border-accent bg-accent-50 dark:bg-accent-900/20' : 'border-primary-200 dark:border-primary-600',
                )}
              >
                <label className="flex items-center gap-1.5 font-medium">
                  <input type="checkbox" checked={checked} onChange={() => toggleSize(size)} className="h-3.5 w-3.5 rounded" />
                  {size}
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!checked}
                  value={color.sizeStock[size] ?? 0}
                  onChange={(e) => setSizeQty(size, Number(e.target.value))}
                  className="w-full rounded-md border border-primary-200 px-1.5 py-1 text-center text-sm disabled:opacity-40 dark:border-primary-600 dark:bg-primary-800"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SellerProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = isStaffRole(user?.role);
  const basePath = isStaff ? '/staff' : '/seller';
  const { data: permissions } = useStaffPermissions();

  const { data: existingProduct, isLoading: isLoadingProduct } = useSellerProduct(id);
  const { data: existingInventory, isLoading: isLoadingInventory } = useInventory(id);
  const { data: brands } = useQuery({ queryKey: ['seller', 'brands'], queryFn: () => brandService.list() });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: categories } = useQuery({ queryKey: ['seller', 'categories', form.gender], queryFn: () => categoryService.list(form.gender) });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isSaving = isSubmitting || createProduct.isPending || updateProduct.isPending;

  const isProductDataReady = !isEditing || (!isLoadingProduct && !isLoadingInventory && Boolean(existingProduct));

  useEffect(() => {
    if (isInitialized) return;
    if (!isEditing) {
      setIsInitialized(true);
      return;
    }
    if (!existingProduct || isLoadingInventory) return;

    const colorInputs = toColorInputs(existingProduct, existingInventory ?? null);
    setForm({
      name: existingProduct.name,
      sku: existingProduct.sku,
      brand_id: existingProduct.brand_id,
      category_id: existingProduct.category_id,
      subcategory: existingProduct.subcategory ?? '',
      gender: existingProduct.gender,
      description: existingProduct.description,
      fabric: existingProduct.specifications.fabric,
      sleeve: existingProduct.specifications.sleeve ?? '',
      fit: existingProduct.specifications.fit,
      pattern: existingProduct.specifications.pattern ?? '',
      collar: existingProduct.specifications.collar ?? '',
      occasion: existingProduct.specifications.occasion ?? '',
      price: existingProduct.price,
      mrp: existingProduct.mrp,
      gst_percent: existingProduct.gst_percent,
      cod_available: existingProduct.cod_available,
      low_stock_threshold: existingInventory?.low_stock_threshold ?? 5,
      colors: colorInputs.map((c) => ({
        name: c.name,
        hex: c.hex,
        images: c.images.map((url) => ({ id: newId(), url })),
        sizeStock: { ...c.sizeStock },
      })),
      is_return_eligible: existingProduct.is_return_eligible,
      is_exchange_eligible: existingProduct.is_exchange_eligible,
      status: existingProduct.status,
    });
    setIsInitialized(true);
  }, [existingProduct, existingInventory, isLoadingInventory, isEditing, isInitialized]);

  const categoriesForGender = categories ?? [];
  const discountPercent = calculateDiscount(form.mrp, form.price);
  const mrpError = form.mrp > 0 && form.price > 0 && form.mrp < form.price ? 'MRP must be greater than or equal to the selling price' : undefined;
  const totalImages = useMemo(() => form.colors.reduce((sum, c) => sum + c.images.length, 0), [form.colors]);

  // Access gate: a pending/suspended seller can't touch this page — except a Head Seller, who
  // always has access (e.g. editing another seller's product) regardless of their own seller_status.
  const isHeadSellerUser = isHeadSeller(user?.role);
  const isBlockedBySellerStatus = !isHeadSellerUser && (user?.seller_status === 'pending' || user?.seller_status === 'suspended');
  // A staff account without the corresponding permission is blocked outright, even if they reach
  // this page directly by URL rather than through the (already permission-gated) Products list.
  const isBlockedByStaffPermission = isStaff && !(isEditing ? permissions?.edit_products : permissions?.add_products);

  const updateColor = (index: number, patch: Partial<ColorFormState>) => {
    setForm((prev) => ({ ...prev, colors: prev.colors.map((c, i) => (i === index ? { ...c, ...patch } : c)) }));
  };

  const addColor = () => {
    setForm((prev) => ({ ...prev, colors: [...prev.colors, { name: '', hex: '#6b7280', images: [], sizeStock: {} }] }));
  };

  const removeColor = (index: number) => {
    setForm((prev) => {
      const removed = prev.colors[index];
      removed?.images.forEach((img) => {
        if (img.file) URL.revokeObjectURL(img.url);
      });
      return { ...prev, colors: prev.colors.filter((_, i) => i !== index) };
    });
  };

  const handleAutoGenerateSku = () => {
    const categoryName = categoriesForGender.find((c) => c.id === form.category_id)?.name ?? '';
    const brandName = (brands ?? []).find((b) => b.id === form.brand_id)?.name ?? '';
    setForm((prev) => ({ ...prev, sku: generateSku(categoryName, brandName) }));
  };

  function validate(): string | null {
    if (!form.name.trim()) return 'Product name is required';
    if (!form.brand_id) return 'Brand is required';
    if (!form.category_id) return 'Category is required';
    if (!form.description.trim()) return 'Description is required';
    if (form.price <= 0) return 'Price must be greater than 0';
    if (form.mrp < form.price) return 'MRP must be greater than or equal to the selling price';
    if (form.colors.length === 0) return 'Add at least one color';
    if (form.colors.some((c) => !c.name.trim())) return 'Every color needs a name';
    if (totalImages === 0) return 'Add at least one product image';
    const hasStock = form.colors.some((c) => Object.values(c.sizeStock).some((n) => n > 0));
    if (!hasStock) return 'Add stock for at least one size';
    return null;
  }

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!user) return;

    const sellerId = isEditing && existingProduct ? existingProduct.seller_id : effectiveSellerId(user);
    const sellerName = isEditing && existingProduct ? existingProduct.seller_name : user.store_name ?? user.full_name;
    // Present only when a staff member (not the seller themselves) is performing this action —
    // see productService.create/update's `actor` param and its created_by/staff_id/staff_name fields.
    const actor = isStaff ? { id: user.id, name: user.full_name } : undefined;

    setIsSubmitting(true);

    let colors: SellerProductColorInput[];
    try {
      colors = await Promise.all(
        form.colors.map(async (c) => {
          const pendingFiles = c.images.filter((img) => img.file).map((img) => img.file as File);
          const uploadedUrls = pendingFiles.length > 0 ? await uploadProductImages(pendingFiles, sellerId) : [];
          let uploadIdx = 0;
          const finalImages = c.images.map((img) => (img.file ? uploadedUrls[uploadIdx++] : img.url));
          const sizeStock = Object.fromEntries(Object.entries(c.sizeStock).filter(([, v]) => v > 0));
          return { name: c.name.trim(), hex: c.hex, images: finalImages, sizeStock };
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Image upload failed');
      setIsSubmitting(false);
      return;
    }

    const input: SellerProductInput = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      brand_id: form.brand_id,
      category_id: form.category_id,
      subcategory: form.subcategory.trim(),
      gender: form.gender,
      description: form.description,
      fabric: form.fabric,
      sleeve: form.sleeve,
      fit: form.fit,
      pattern: form.pattern,
      collar: form.collar,
      occasion: form.occasion,
      price: form.price,
      mrp: form.mrp,
      gst_percent: form.gst_percent,
      cod_available: form.cod_available,
      low_stock_threshold: form.low_stock_threshold,
      colors,
      is_return_eligible: form.is_return_eligible,
      is_exchange_eligible: form.is_exchange_eligible,
      status: form.status,
    };

    try {
      if (isEditing && id) {
        await updateProduct.mutateAsync({ productId: id, sellerId, sellerName, input, actor });
      } else {
        await createProduct.mutateAsync({ sellerId, sellerName, input, actor });
      }
      navigate(`${basePath}/products`);
    } catch {
      // The mutation hook already surfaces a toast on failure.
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && !isProductDataReady) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isBlockedBySellerStatus) {
    return (
      <div className="mx-auto max-w-xl">
        <Seo title="Add Product" />
        <div className="card-surface flex flex-col items-center p-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30">
            <ShieldAlert size={26} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-bold">
            {user?.seller_status === 'pending' ? 'Your seller application is awaiting approval' : `Your seller account is ${user?.seller_status}`}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-primary-500">
            {user?.seller_status === 'pending'
              ? "You can't add or edit products yet — this unlocks as soon as the Head Seller approves your account."
              : user?.seller_status_reason ?? 'You cannot add or edit products while your account is in this state.'}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => navigate(`${basePath}/products`)}>
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  if (isBlockedByStaffPermission) {
    return (
      <div className="mx-auto max-w-xl">
        <Seo title={isEditing ? 'Edit Product' : 'Add Product'} />
        <div className="card-surface flex flex-col items-center p-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30">
            <ShieldAlert size={26} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-bold">You don't have permission to {isEditing ? 'edit' : 'add'} products</h2>
          <p className="mt-2 max-w-sm text-sm text-primary-500">Ask the Head Seller to grant you this permission from Staff Management.</p>
          <Button variant="outline" className="mt-6" onClick={() => navigate(`${basePath}/products`)}>
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Seo title={isEditing ? 'Edit Product' : 'Add Product'} />
      <h1 className="mb-6 text-2xl font-bold">{isEditing ? 'Edit Product' : 'Add Product'}</h1>

      <div className="space-y-6">
        {/* Basic information */}
        <section className="card-surface grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h2 className="col-span-full font-semibold">Basic Information</h2>
          <Field label="Product Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Brand" required>
            <select className="input-field" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
              <option value="">Select brand</option>
              {(brands ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gender" required>
            <select
              className="input-field"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as Gender, category_id: '' })}
            >
              <option value="men">Men</option>
              <option value="kids">Kids</option>
            </select>
          </Field>
          <Field label="Category" required>
            <select className="input-field" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Select category</option>
              {categoriesForGender.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sub Category">
            <Input
              value={form.subcategory}
              onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
              placeholder="e.g. Polo Shirts"
            />
          </Field>
          <Field label="SKU">
            <div className="flex gap-2">
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Leave blank to auto-generate" />
              <Button type="button" variant="outline" size="md" onClick={handleAutoGenerateSku} title="Auto-generate SKU">
                <Wand2 size={14} />
              </Button>
            </div>
          </Field>
          <div className="col-span-full">
            <Field label="Description" required>
              <textarea
                className="input-field min-h-24"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Fabric">
            <Input list="fabrics" value={form.fabric} onChange={(e) => setForm({ ...form, fabric: e.target.value })} />
            <datalist id="fabrics">
              {MATERIALS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="Sleeve Type">
            <Input list="sleeves" value={form.sleeve} onChange={(e) => setForm({ ...form, sleeve: e.target.value })} />
            <datalist id="sleeves">
              {SLEEVE_OPTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Fit">
            <Input list="fits" value={form.fit} onChange={(e) => setForm({ ...form, fit: e.target.value })} />
            <datalist id="fits">
              {FITS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Field>
          <Field label="Pattern">
            <Input list="patterns" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} />
            <datalist id="patterns">
              {PATTERNS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Collar Type">
            <Input list="collars" value={form.collar} onChange={(e) => setForm({ ...form, collar: e.target.value })} />
            <datalist id="collars">
              {COLLAR_OPTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Occasion">
            <Input list="occasions" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} />
            <datalist id="occasions">
              {OCCASIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
        </section>

        {/* Pricing */}
        <section className="card-surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <h2 className="col-span-full font-semibold">Pricing</h2>
          <Field label="Selling Price (₹)" required>
            <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label="MRP (₹)" required>
            <Input
              type="number"
              min={0}
              value={form.mrp}
              onChange={(e) => setForm({ ...form, mrp: Math.max(0, Number(e.target.value) || 0) })}
              error={mrpError}
            />
          </Field>
          <Field label="Discount">
            <div className="input-field flex items-center bg-primary-50 text-primary-500 dark:bg-primary-800">{discountPercent}%</div>
          </Field>
          <Field label="GST (%)">
            <Input type="number" min={0} value={form.gst_percent} onChange={(e) => setForm({ ...form, gst_percent: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <div className="col-span-full flex items-center gap-4">
            <span className="text-sm font-medium text-primary-800 dark:text-primary-100">Cash on Delivery</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={form.cod_available} onChange={() => setForm({ ...form, cod_available: true })} /> Available
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="radio" checked={!form.cod_available} onChange={() => setForm({ ...form, cod_available: false })} /> Not Available
            </label>
          </div>
        </section>

        {/* Status */}
        <section className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Product Status</h2>
          <select className="input-field max-w-xs" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-primary-400">
            Draft and Hidden aren't visible to buyers. Active and Out of Stock both show in the catalog — Out of Stock just marks it
            unavailable to purchase. Out of Stock is normally implied once every size's stock reaches zero, but you can set it manually here too.
          </p>
        </section>

        {/* Colors */}
        <section className="card-surface p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Colors</h2>
            <span className={cn('text-xs font-medium', totalImages >= MAX_IMAGES ? 'text-red-500' : 'text-primary-400')}>
              {totalImages} / {MAX_IMAGES} images used
            </span>
          </div>
          <p className="mb-4 text-xs text-primary-400">
            Each color has its own image gallery and per-size stock. The first image of the first color becomes the product's cover photo.
          </p>

          <div className="space-y-4">
            {form.colors.map((color, index) => (
              <ColorCard
                key={index}
                color={color}
                index={index}
                canRemove={form.colors.length > 0}
                remainingImageSlots={MAX_IMAGES - totalImages}
                onChange={(patch) => updateColor(index, patch)}
                onRemove={() => removeColor(index)}
              />
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={addColor}>
            <Plus size={14} /> Add Color
          </Button>
        </section>

        {/* Stock alert */}
        <section className="card-surface grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h2 className="col-span-full font-semibold">Inventory Alerts</h2>
          <Field label="Low Stock Alert">
            <Input
              type="number"
              min={0}
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
        </section>

        {/* Return / exchange */}
        <section className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Return &amp; Exchange</h2>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_return_eligible}
                onChange={(e) => setForm({ ...form, is_return_eligible: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              Return eligible
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_exchange_eligible}
                onChange={(e) => setForm({ ...form, is_exchange_eligible: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              Exchange eligible
            </label>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(`${basePath}/products`)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleSubmit} isLoading={isSaving}>
            Save Product
          </Button>
        </div>
      </div>
    </div>
  );
}

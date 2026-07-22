import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FolderHeart, Plus, Pencil, Trash2, Share2, Inbox, ArrowLeft } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProductImage } from '@/components/ui/ProductImage';
import { CollectionNameModal } from '@/components/wishlist/CollectionNameModal';
import { ShareCollectionModal } from '@/components/wishlist/ShareCollectionModal';
import { useWishlist } from '@/hooks/useWishlist';
import { useWishlistCollections } from '@/hooks/useWishlistCollections';
import { formatCurrency, cn } from '@/lib/utils';
import type { Product, WishlistCollection } from '@/types';

const UNSORTED = 'unsorted';

function ProductRow({ product, moveOptions, currentValue, onMove }: { product: Product; moveOptions: { value: string; label: string }[]; currentValue: string; onMove: (value: string) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-primary-100 py-4 last:border-0 dark:border-primary-700">
      <Link to={`/product/${product.slug}`} className="shrink-0">
        <ProductImage src={product.imageUrl ?? product.images[0]?.url} alt={product.name} className="h-16 w-14 rounded-lg" priority />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/product/${product.slug}`} className="line-clamp-1 text-sm font-medium hover:text-accent-600">
          {product.name}
        </Link>
        <p className="text-xs text-primary-400">{formatCurrency(product.price)}</p>
      </div>
      <select
        value={currentValue}
        onChange={(e) => onMove(e.target.value)}
        className="shrink-0 rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-xs dark:border-primary-600 dark:bg-primary-800"
        aria-label={`Move ${product.name} to a different collection`}
      >
        {moveOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function WishlistCollectionsPage() {
  const { items: wishlistItems, isLoading: isLoadingWishlist } = useWishlist();
  const { collections, isLoading: isLoadingCollections, create, rename, remove, moveProduct, share, unshare } = useWishlistCollections();

  const [selected, setSelected] = useState<string>(UNSORTED);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renamingCollection, setRenamingCollection] = useState<WishlistCollection | null>(null);
  const [sharingCollection, setSharingCollection] = useState<WishlistCollection | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<WishlistCollection | null>(null);

  const organizedProductIds = useMemo(() => new Set(collections.flatMap((c) => c.product_ids)), [collections]);
  const unsortedProducts = useMemo(
    () => wishlistItems.filter((i) => i.product && !organizedProductIds.has(i.product_id)).map((i) => i.product as Product),
    [wishlistItems, organizedProductIds],
  );

  const activeCollection = collections.find((c) => c.id === selected) ?? null;
  const activeProducts = useMemo(() => {
    if (selected === UNSORTED) return unsortedProducts;
    if (!activeCollection) return [];
    return wishlistItems.filter((i) => i.product && activeCollection.product_ids.includes(i.product_id)).map((i) => i.product as Product);
  }, [selected, activeCollection, unsortedProducts, wishlistItems]);

  const moveOptions = useMemo(
    () => [{ value: UNSORTED, label: 'Unsorted' }, ...collections.map((c) => ({ value: c.id, label: c.name }))],
    [collections],
  );

  const isLoading = isLoadingWishlist || isLoadingCollections;

  const handleMove = async (productId: string, toValue: string) => {
    await moveProduct({ productId, toCollectionId: toValue === UNSORTED ? null : toValue });
  };

  const handleDelete = async () => {
    if (!deletingCollection) return;
    if (selected === deletingCollection.id) setSelected(UNSORTED);
    await remove(deletingCollection.id);
    setDeletingCollection(null);
  };

  if (isLoading) {
    return (
      <div className="container-app py-8">
        <Skeleton className="mb-6 h-8 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="container-app py-8">
        <Seo title="Wishlist Collections" />
        <EmptyState
          icon={FolderHeart}
          title="Nothing to organize yet"
          description="Add items to your wishlist first, then come back here to sort them into collections."
          actionLabel="Go to Wishlist"
          actionHref="/wishlist"
        />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <Seo title="Wishlist Collections" description="Organize your DressMart wishlist into named collections and share them." />
      <Link to="/wishlist" className="mb-4 inline-flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-900 dark:hover:text-white">
        <ArrowLeft size={15} /> Back to Wishlist
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <FolderHeart size={22} className="text-accent" />
        <h1 className="text-xl font-bold sm:text-2xl">Wishlist Collections</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card-surface h-fit p-3 lg:sticky lg:top-24">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            <button
              onClick={() => setSelected(UNSORTED)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                selected === UNSORTED ? 'bg-primary text-white' : 'text-primary-600 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-800',
              )}
            >
              <Inbox size={16} />
              Unsorted ({unsortedProducts.length})
            </button>

            {collections.map((c) => (
              <div key={c.id} className="group flex shrink-0 items-center">
                <button
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    'flex flex-1 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                    selected === c.id ? 'bg-primary text-white' : 'text-primary-600 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-800',
                  )}
                >
                  <FolderHeart size={16} />
                  <span className="truncate">
                    {c.name} ({c.product_ids.length})
                  </span>
                </button>
              </div>
            ))}
          </nav>

          {activeCollection && (
            <div className="mt-2 flex items-center gap-1 border-t border-primary-100 px-1 pt-2 dark:border-primary-700">
              <button
                onClick={() => setRenamingCollection(activeCollection)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-800"
              >
                <Pencil size={12} /> Rename
              </button>
              <button
                onClick={() => setSharingCollection(activeCollection)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-800"
              >
                <Share2 size={12} /> {activeCollection.share_slug ? 'Shared' : 'Share'}
              </button>
              <button
                onClick={() => setDeletingCollection(activeCollection)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}

          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary-300 py-2.5 text-sm font-medium text-accent-600 hover:border-accent dark:border-primary-600"
          >
            <Plus size={15} /> New Collection
          </button>
        </aside>

        <div className="card-surface p-5">
          <h2 className="mb-1 font-semibold">{selected === UNSORTED ? 'Unsorted' : activeCollection?.name}</h2>
          <p className="mb-4 text-sm text-primary-400">
            {activeProducts.length} {activeProducts.length === 1 ? 'item' : 'items'}
            {selected === UNSORTED && ' — file these into a collection using the dropdown on each item.'}
          </p>

          {activeProducts.length === 0 ? (
            <EmptyState icon={FolderHeart} title="No items here" description={selected === UNSORTED ? 'Everything is organized!' : 'Move wishlisted items here from Unsorted.'} />
          ) : (
            <div>
              {activeProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  moveOptions={moveOptions}
                  currentValue={selected}
                  onMove={(value) => handleMove(product.id, value)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CollectionNameModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Collection"
        submitLabel="Create Collection"
        onSubmit={async (name) => {
          await create(name);
        }}
      />

      <CollectionNameModal
        isOpen={Boolean(renamingCollection)}
        onClose={() => setRenamingCollection(null)}
        title="Rename Collection"
        submitLabel="Save Changes"
        initialName={renamingCollection?.name ?? ''}
        onSubmit={async (name) => {
          if (!renamingCollection) return;
          await rename({ collectionId: renamingCollection.id, name });
        }}
      />

      <ShareCollectionModal
        isOpen={Boolean(sharingCollection)}
        onClose={() => setSharingCollection(null)}
        collection={collections.find((c) => c.id === sharingCollection?.id) ?? sharingCollection}
        onShare={share}
        onUnshare={unshare}
      />

      <Modal isOpen={Boolean(deletingCollection)} onClose={() => setDeletingCollection(null)} title={`Delete "${deletingCollection?.name}"?`}>
        <p className="mb-4 text-sm text-primary-500">
          This only removes the collection — the items themselves will stay in your wishlist as Unsorted.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setDeletingCollection(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              handleDelete().catch(() => toast.error('Could not delete this collection'));
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

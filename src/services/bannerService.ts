/**
 * The dynamic banner CMS (admin-managed offers, live in Supabase) is cut for simplicity per product
 * decision — this is now a small hardcoded array, no backend call at all. If a Head Seller-managed
 * banner editor is ever wanted again, re-introduce a `banners` collection + queryKeys entry then.
 */
export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  link: string;
  sort_order: number;
  is_active: boolean;
}

const BANNERS: Banner[] = [
  { id: 'banner-1', title: 'Season Launch', subtitle: 'Fresh Formal Shirts starting at ₹799', link: '/men/formal-shirts', sort_order: 0, is_active: true },
  { id: 'banner-2', title: 'Denim Fest', subtitle: 'Flat 30% off on Jeans & Cargo Pants', link: '/men/slim-jeans', sort_order: 1, is_active: true },
  { id: 'banner-3', title: 'Kids Wonderland', subtitle: 'Playful styles for your little ones', link: '/kids', sort_order: 2, is_active: true },
  { id: 'banner-4', title: 'Winter Edit', subtitle: 'Hoodies & Jackets up to 45% off', link: '/men/jackets', sort_order: 3, is_active: true },
];

export const bannerService = {
  list(): Banner[] {
    return BANNERS.filter((b) => b.is_active).sort((a, b) => a.sort_order - b.sort_order);
  },
};

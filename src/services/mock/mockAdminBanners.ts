import type { Banner } from '@/types';
import { readStore, writeStore } from './mockStorage';

const BANNERS_KEY = 'admin-banners';

const SEED_BANNERS: Banner[] = [
  { id: 'b1', title: 'Season Launch', subtitle: 'Fresh Formal Shirts starting at ₹799', image_url: '', link: '/men/formal-shirts', sort_order: 0, is_active: true },
  { id: 'b2', title: 'Denim Fest', subtitle: 'Flat 30% off on Jeans & Cargo Pants', image_url: '', link: '/men/slim-jeans', sort_order: 1, is_active: true },
  { id: 'b3', title: 'Kids Wonderland', subtitle: 'Playful styles for your little ones', image_url: '', link: '/kids', sort_order: 2, is_active: true },
  { id: 'b4', title: 'Winter Edit', subtitle: 'Hoodies & Jackets up to 45% off', image_url: '', link: '/men/jackets', sort_order: 3, is_active: true },
];

export function getAllBanners(): Banner[] {
  return readStore<Banner[]>(BANNERS_KEY, SEED_BANNERS);
}

export function saveBanner(banner: Banner): void {
  const banners = getAllBanners();
  const idx = banners.findIndex((b) => b.id === banner.id);
  if (idx >= 0) banners[idx] = banner;
  else banners.push(banner);
  writeStore(BANNERS_KEY, banners);
}

export function deleteBanner(bannerId: string): void {
  writeStore(
    BANNERS_KEY,
    getAllBanners().filter((b) => b.id !== bannerId),
  );
}

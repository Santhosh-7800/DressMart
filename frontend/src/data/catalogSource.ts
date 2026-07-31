import type { Gender } from '@/types';

/** Original, fictional brand roster (no real-world trademarks). */
export interface BrandDef {
  name: string;
  slug: string;
  description: string;
  isFeatured: boolean;
  focus: 'men' | 'kids' | 'both';
}

export const BRAND_DEFS: BrandDef[] = [
  { name: 'Northfield & Co.', slug: 'northfield-co', description: 'Tailored classics for the modern workplace.', isFeatured: true, focus: 'men' },
  { name: 'Urban Threadworks', slug: 'urban-threadworks', description: 'Streetwear-inspired essentials for everyday wear.', isFeatured: true, focus: 'men' },
  { name: 'Bellcrest', slug: 'bellcrest', description: 'Premium fabrics, quiet luxury silhouettes.', isFeatured: true, focus: 'men' },
  { name: 'Rugged Anchor', slug: 'rugged-anchor', description: 'Built-to-last outdoor and utility wear.', isFeatured: false, focus: 'men' },
  { name: 'Kingsley & Sons', slug: 'kingsley-sons', description: 'Heritage menswear with a modern cut.', isFeatured: true, focus: 'men' },
  { name: 'Milano Vault', slug: 'milano-vault', description: 'European-inspired formalwear.', isFeatured: false, focus: 'men' },
  { name: 'Voltage Athletics', slug: 'voltage-athletics', description: 'Performance fits for training and travel.', isFeatured: true, focus: 'men' },
  { name: 'Basecamp Supply Co.', slug: 'basecamp-supply', description: 'Rugged layers for cold-weather living.', isFeatured: false, focus: 'men' },
  { name: 'Loom & Fold', slug: 'loom-fold', description: 'Sustainable cotton essentials.', isFeatured: false, focus: 'men' },
  { name: 'Ashworth Studio', slug: 'ashworth-studio', description: 'Minimalist tailoring for every day.', isFeatured: false, focus: 'men' },
  { name: 'Prairie Denim Co.', slug: 'prairie-denim', description: 'Denim specialists since the drawing board.', isFeatured: true, focus: 'men' },
  { name: 'Crownridge', slug: 'crownridge', description: 'Ethnic wear reimagined for celebrations.', isFeatured: false, focus: 'men' },
  { name: 'Fieldstone Footwear', slug: 'fieldstone-footwear', description: 'Comfort-engineered shoes for every step.', isFeatured: true, focus: 'both' },
  { name: 'Meridian Time Co.', slug: 'meridian-time', description: 'Understated watches for daily wear.', isFeatured: false, focus: 'men' },
  { name: 'Junior Voyage', slug: 'junior-voyage', description: 'Playful, durable clothing for growing kids.', isFeatured: true, focus: 'kids' },
  { name: 'Little Anchor', slug: 'little-anchor', description: 'Soft, safe fabrics for little ones.', isFeatured: true, focus: 'kids' },
  { name: 'Rascal & Bloom', slug: 'rascal-bloom', description: 'Bright everyday wear for playful kids.', isFeatured: false, focus: 'kids' },
  { name: 'Tiny Trailblazers', slug: 'tiny-trailblazers', description: 'Adventure-ready outfits for active kids.', isFeatured: false, focus: 'kids' },
  { name: 'Cloudstep Kids', slug: 'cloudstep-kids', description: 'Lightweight, breathable kidswear.', isFeatured: false, focus: 'kids' },
  { name: 'Winterhaven Jr.', slug: 'winterhaven-jr', description: 'Warm winter layers built for play.', isFeatured: false, focus: 'kids' },

  // Named brands used by the curated Shirts catalog (real marketplace-listing names, matching the
  // real product photography sourced for those SKUs — kept distinct from the fictional roster above).
  { name: 'DressMart Collection', slug: 'dressmart-collection', description: "DressMart's own in-house shirt label.", isFeatured: true, focus: 'men' },
  { name: 'The Indian Garage Co', slug: 'the-indian-garage-co', description: 'Slim-fit casualwear with a modern edge.', isFeatured: false, focus: 'men' },
  { name: 'Thomas Scott', slug: 'thomas-scott', description: 'Contemporary printed and casual shirting.', isFeatured: false, focus: 'men' },
  { name: 'DHRUVI TRENDZ', slug: 'dhruvi-trendz', description: 'Vacation and resort-ready prints.', isFeatured: false, focus: 'men' },
  { name: 'ZEROYAA', slug: 'zeroyaa', description: 'Bold party and going-out shirting.', isFeatured: false, focus: 'men' },
  { name: 'StitchX', slug: 'stitchx', description: 'Knitted and mandarin-collar everyday shirts.', isFeatured: false, focus: 'men' },
  { name: 'Urbano Fashion', slug: 'urbano-fashion', description: 'Regular-fit cotton casual shirting.', isFeatured: false, focus: 'men' },
  { name: 'Peter England', slug: 'peter-england', description: 'Everyday formal and semi-formal shirting.', isFeatured: false, focus: 'men' },
  { name: 'Diverse', slug: 'diverse', description: 'Poly-cotton shirting for daily wear.', isFeatured: false, focus: 'men' },
  { name: 'Symbol', slug: 'symbol', description: 'Cotton formal and casual shirt essentials.', isFeatured: false, focus: 'men' },
  { name: 'Axe & Hammer', slug: 'axe-hammer', description: 'Everyday cotton innerwear essentials.', isFeatured: false, focus: 'men' },
];

export interface CategoryDef {
  name: string;
  slug: string;
  gender: Gender;
  productCount: number;
  sizeSet: 'apparel' | 'jeans' | 'shoes' | 'kids-age' | 'belt' | 'onesize';
  garmentType: string;
}

export const MEN_CATEGORY_DEFS: CategoryDef[] = [
  { name: 'Formal Shirts', slug: 'formal-shirts', gender: 'men', productCount: 200, sizeSet: 'apparel', garmentType: 'shirt' },
  { name: 'Casual Shirts', slug: 'casual-shirts', gender: 'men', productCount: 150, sizeSet: 'apparel', garmentType: 'shirt' },
  { name: 'Printed Shirts', slug: 'printed-shirts', gender: 'men', productCount: 40, sizeSet: 'apparel', garmentType: 'shirt' },
  { name: 'Checked Shirts', slug: 'checked-shirts', gender: 'men', productCount: 40, sizeSet: 'apparel', garmentType: 'shirt' },
  { name: 'Solid Shirts', slug: 'solid-shirts', gender: 'men', productCount: 40, sizeSet: 'apparel', garmentType: 'shirt' },
  { name: 'Linen Shirts', slug: 'linen-shirts', gender: 'men', productCount: 30, sizeSet: 'apparel', garmentType: 'shirt' },
  { name: 'Cotton Shirts', slug: 'cotton-shirts', gender: 'men', productCount: 30, sizeSet: 'apparel', garmentType: 'shirt' },
  { name: 'Polo T-Shirts', slug: 'polo-tshirts', gender: 'men', productCount: 60, sizeSet: 'apparel', garmentType: 'tshirt' },
  { name: 'Round Neck T-Shirts', slug: 'round-neck-tshirts', gender: 'men', productCount: 50, sizeSet: 'apparel', garmentType: 'tshirt' },
  { name: 'Oversized T-Shirts', slug: 'oversized-tshirts', gender: 'men', productCount: 25, sizeSet: 'apparel', garmentType: 'tshirt' },
  { name: 'Henley T-Shirts', slug: 'henley-tshirts', gender: 'men', productCount: 15, sizeSet: 'apparel', garmentType: 'tshirt' },
  { name: 'Slim Jeans', slug: 'slim-jeans', gender: 'men', productCount: 50, sizeSet: 'jeans', garmentType: 'jeans' },
  { name: 'Regular Jeans', slug: 'regular-jeans', gender: 'men', productCount: 50, sizeSet: 'jeans', garmentType: 'jeans' },
  { name: 'Cargo Pants', slug: 'cargo-pants', gender: 'men', productCount: 100, sizeSet: 'jeans', garmentType: 'pants' },
  { name: 'Joggers', slug: 'joggers', gender: 'men', productCount: 100, sizeSet: 'apparel', garmentType: 'pants' },
  { name: 'Shorts', slug: 'shorts', gender: 'men', productCount: 40, sizeSet: 'apparel', garmentType: 'pants' },
  { name: 'Formal Pants', slug: 'formal-pants', gender: 'men', productCount: 40, sizeSet: 'jeans', garmentType: 'pants' },
  { name: 'Blazers', slug: 'blazers', gender: 'men', productCount: 20, sizeSet: 'apparel', garmentType: 'jacket' },
  { name: 'Jackets', slug: 'jackets', gender: 'men', productCount: 100, sizeSet: 'apparel', garmentType: 'jacket' },
  { name: 'Hoodies', slug: 'hoodies', gender: 'men', productCount: 100, sizeSet: 'apparel', garmentType: 'hoodie' },
  { name: 'Sweatshirts', slug: 'sweatshirts', gender: 'men', productCount: 30, sizeSet: 'apparel', garmentType: 'hoodie' },
  { name: 'Kurtas', slug: 'kurtas', gender: 'men', productCount: 30, sizeSet: 'apparel', garmentType: 'shirt' },
  { name: 'Sherwanis', slug: 'sherwanis', gender: 'men', productCount: 10, sizeSet: 'apparel', garmentType: 'jacket' },
  { name: 'Innerwear', slug: 'innerwear', gender: 'men', productCount: 30, sizeSet: 'apparel', garmentType: 'tshirt' },
  { name: 'Belts', slug: 'belts', gender: 'men', productCount: 20, sizeSet: 'belt', garmentType: 'default' },
  { name: 'Vests', slug: 'vests', gender: 'men', productCount: 15, sizeSet: 'apparel', garmentType: 'tshirt' },
  { name: 'Wallets', slug: 'wallets', gender: 'men', productCount: 20, sizeSet: 'onesize', garmentType: 'default' },
  { name: 'Sneakers', slug: 'sneakers', gender: 'men', productCount: 40, sizeSet: 'shoes', garmentType: 'shoe' },
  { name: 'Loafers', slug: 'loafers', gender: 'men', productCount: 20, sizeSet: 'shoes', garmentType: 'shoe' },
  { name: 'Sports Shoes', slug: 'sports-shoes', gender: 'men', productCount: 30, sizeSet: 'shoes', garmentType: 'shoe' },
  { name: 'Sandals', slug: 'sandals', gender: 'men', productCount: 10, sizeSet: 'shoes', garmentType: 'shoe' },
  { name: 'Watches', slug: 'watches', gender: 'men', productCount: 20, sizeSet: 'onesize', garmentType: 'watch' },
];

export const KIDS_CATEGORY_DEFS: CategoryDef[] = [
  { name: 'T-Shirts', slug: 'kids-tshirts', gender: 'kids', productCount: 30, sizeSet: 'kids-age', garmentType: 'tshirt' },
  { name: 'Shirts', slug: 'kids-shirts', gender: 'kids', productCount: 20, sizeSet: 'kids-age', garmentType: 'shirt' },
  { name: 'Jeans', slug: 'kids-jeans', gender: 'kids', productCount: 20, sizeSet: 'kids-age', garmentType: 'jeans' },
  { name: 'Shorts', slug: 'kids-shorts', gender: 'kids', productCount: 15, sizeSet: 'kids-age', garmentType: 'pants' },
  { name: 'Joggers', slug: 'kids-joggers', gender: 'kids', productCount: 15, sizeSet: 'kids-age', garmentType: 'pants' },
  { name: 'School Uniform', slug: 'school-uniform', gender: 'kids', productCount: 15, sizeSet: 'kids-age', garmentType: 'shirt' },
  { name: 'Party Wear', slug: 'kids-party-wear', gender: 'kids', productCount: 10, sizeSet: 'kids-age', garmentType: 'shirt' },
  { name: 'Hoodies', slug: 'kids-hoodies', gender: 'kids', productCount: 10, sizeSet: 'kids-age', garmentType: 'hoodie' },
  { name: 'Sweaters', slug: 'kids-sweaters', gender: 'kids', productCount: 10, sizeSet: 'kids-age', garmentType: 'hoodie' },
  { name: 'Winter Wear', slug: 'kids-winter-wear', gender: 'kids', productCount: 5, sizeSet: 'kids-age', garmentType: 'jacket' },
  { name: 'Jackets', slug: 'kids-jackets', gender: 'kids', productCount: 5, sizeSet: 'kids-age', garmentType: 'jacket' },
  { name: 'Shoes', slug: 'kids-shoes', gender: 'kids', productCount: 10, sizeSet: 'shoes', garmentType: 'shoe' },
  { name: 'Sandals', slug: 'kids-sandals', gender: 'kids', productCount: 5, sizeSet: 'shoes', garmentType: 'shoe' },
];

export const SIZE_SETS: Record<CategoryDef['sizeSet'], string[]> = {
  apparel: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  jeans: ['28', '30', '32', '34', '36', '38'],
  shoes: ['6', '7', '8', '9', '10', '11'],
  'kids-age': ['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y', '12-13Y', '14-15Y'],
  belt: ['S', 'M', 'L', 'XL'],
  onesize: ['One Size'],
};

export const COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: 'Navy Blue', hex: '#1e3a5f' },
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'White', hex: '#f5f5f0' },
  { name: 'Charcoal Grey', hex: '#454545' },
  { name: 'Maroon', hex: '#6b1f2a' },
  { name: 'Olive Green', hex: '#5c6b3f' },
  { name: 'Mustard Yellow', hex: '#d4a72c' },
  { name: 'Sky Blue', hex: '#6fa8c9' },
  { name: 'Beige', hex: '#d8c7a1' },
  { name: 'Khaki', hex: '#8a7a5c' },
  { name: 'Burgundy', hex: '#5e2129' },
  { name: 'Rust Orange', hex: '#b5502e' },
  { name: 'Forest Green', hex: '#2f4a3e' },
  { name: 'Steel Grey', hex: '#6b7280' },
  { name: 'Powder Blue', hex: '#a9c6d8' },
  { name: 'Wine Red', hex: '#7a2436' },
  { name: 'Teal', hex: '#2c6e6b' },
  { name: 'Coral', hex: '#e08a6f' },
  { name: 'Denim Blue', hex: '#3b5a7a' },
  { name: 'Brown', hex: '#5a3d2b' },
];

export const MATERIALS = ['100% Cotton', 'Cotton Blend', 'Linen Blend', 'Polyester Blend', 'Denim', 'Fleece', 'Rib-Knit Cotton', 'Corduroy', 'Twill Cotton', 'Wool Blend'];
export const FITS = ['Slim Fit', 'Regular Fit', 'Relaxed Fit', 'Tailored Fit', 'Oversized Fit', 'Skinny Fit'];
export const PATTERNS = ['Solid', 'Striped', 'Checked', 'Printed', 'Textured', 'Washed'];
export const OCCASIONS = ['Casual', 'Formal', 'Party', 'Everyday', 'Sports', 'Ethnic'];

export const ADJECTIVES = ['Classic', 'Essential', 'Signature', 'Everyday', 'Heritage', 'Modern', 'Urban', 'Premium', 'Comfort-Fit', 'Active'];

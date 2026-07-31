/**
 * Validates every Checked Shirt product's image data end-to-end — the category-specific check
 * requested for this fix (see src/lib/productImages.ts's GENERATED_PLACEHOLDER_COLORS and
 * scripts/generateCheckedShirtPlaceholders.mjs for how the actual files were produced). Checks,
 * per product:
 *
 *   1. Its image folder (public/images/products/men/checked-shirts/) exists.
 *   2. Every image file it references actually exists on disk.
 *   3. Every image path resolves under the checked-shirts folder specifically — never
 *      formal-shirts, casual-shirts, or any other category's folder.
 *   4. It has a non-empty coverImage/thumbnailUrl (no missing thumbnail).
 *   5. No two DIFFERENT products reference the exact same image file (no duplicate mappings).
 *
 * Read-only — reports problems, doesn't fix anything. Exits non-zero if any check fails, so it can
 * be used as a gate (e.g. after reseeding, or in CI).
 *
 * Usage: FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/validateCheckedShirtImages.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { db } from './seedFirestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'frontend', 'public');
const CATEGORY_SLUG = 'checked-shirts';
const EXPECTED_FOLDER_FRAGMENT = '/images/products/men/checked-shirts/';

interface Problem {
  productId: string;
  productName: string;
  issue: string;
}

function urlToDiskPath(url: string): string {
  // Product image URLs are always root-relative (served straight out of public/) — see
  // src/lib/productImages.ts's resolveProductImagePath.
  return path.join(PUBLIC_DIR, url.replace(/^\//, ''));
}

export async function main() {
  const problems: Problem[] = [];

  const folderPath = path.join(PUBLIC_DIR, 'images/products/men/checked-shirts');
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    console.error(`✖ Image folder does not exist: ${path.relative(PUBLIC_DIR, folderPath)}`);
    process.exit(1);
  }

  const catSnap = await db.collection('categories').where('slug', '==', CATEGORY_SLUG).limit(1).get();
  if (catSnap.empty) {
    console.error(`✖ No category found with slug "${CATEGORY_SLUG}" — run the seed script first.`);
    process.exit(1);
  }
  const categoryId = catSnap.docs[0].id;

  const productsSnap = await db.collection('products').where('category_id', '==', categoryId).get();
  if (productsSnap.empty) {
    console.error(`✖ No products found for category "${CATEGORY_SLUG}" — run the seed script first.`);
    process.exit(1);
  }

  // url -> list of product ids that reference it, to catch cross-product duplicate mappings.
  const urlOwners = new Map<string, string[]>();

  productsSnap.docs.forEach((doc) => {
    const p = doc.data() as {
      id: string;
      name: string;
      coverImage?: string;
      thumbnailUrl?: string;
      images?: { url: string }[];
    };
    const productId = doc.id;
    const productName = p.name ?? '(unnamed)';

    if (!p.coverImage) {
      problems.push({ productId, productName, issue: 'Missing coverImage.' });
    }
    if (!p.thumbnailUrl) {
      problems.push({ productId, productName, issue: 'Missing thumbnailUrl.' });
    }
    if (!p.images || p.images.length === 0) {
      problems.push({ productId, productName, issue: 'No images[] entries at all.' });
      return;
    }

    p.images.forEach((img, idx) => {
      if (!img.url) {
        problems.push({ productId, productName, issue: `images[${idx}] has an empty url.` });
        return;
      }
      if (!img.url.includes(EXPECTED_FOLDER_FRAGMENT)) {
        problems.push({ productId, productName, issue: `images[${idx}] does not point into ${EXPECTED_FOLDER_FRAGMENT}: ${img.url}` });
      }
      const diskPath = urlToDiskPath(img.url);
      if (!fs.existsSync(diskPath)) {
        problems.push({ productId, productName, issue: `images[${idx}] file does not exist on disk: ${img.url}` });
      }
      const owners = urlOwners.get(img.url) ?? [];
      owners.push(productId);
      urlOwners.set(img.url, owners);
    });
  });

  for (const [url, owners] of urlOwners) {
    const distinctOwners = [...new Set(owners)];
    if (distinctOwners.length > 1) {
      problems.push({
        productId: distinctOwners.join(', '),
        productName: '(multiple products)',
        issue: `Image "${url}" is referenced by more than one product — duplicate mapping.`,
      });
    }
  }

  console.log(`Checked ${productsSnap.size} Checked Shirt products, ${urlOwners.size} distinct image URLs.\n`);

  if (problems.length === 0) {
    console.log('✔ All Checked Shirt image data is valid: folder exists, every file exists on disk, every path is scoped to checked-shirts/, no missing thumbnails, no duplicate mappings.');
    return;
  }

  console.error(`✖ Found ${problems.length} problem(s):\n`);
  problems.forEach((p) => console.error(`  - [${p.productId}] ${p.productName}: ${p.issue}`));
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

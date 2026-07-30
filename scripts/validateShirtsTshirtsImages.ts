/**
 * Validates the curated Shirts/T-Shirts batch end-to-end (see curatedShirtsTshirtsData.ts). For
 * every item in that table, checks:
 *
 *   1. Its image folder (public/images/products/men/<folder>/) exists.
 *   2. The product exists in Firestore with the expected sku.
 *   3. Every image file it references actually exists on disk.
 *   4. Every image path resolves under THAT item's own folder — never another category's.
 *   5. The product's variant/image `color` fields exactly match the color the request specified.
 *   6. It has a non-empty coverImage/thumbnailUrl.
 *   7. No two DIFFERENT products (in this batch or the wider catalog) reference the same image file.
 *
 * Read-only — reports problems, doesn't fix anything. Exits non-zero if any check fails.
 *
 * Usage: FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/validateShirtsTshirtsImages.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db } from './seedFirestore';
import { CURATED_SHIRTS_TSHIRTS } from './curatedShirtsTshirtsData';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

interface Problem {
  productId: string;
  issue: string;
}

function urlToDiskPath(url: string): string {
  return path.join(PUBLIC_DIR, decodeURIComponent(url.replace(/^\//, '')));
}

export async function main() {
  const problems: Problem[] = [];
  const urlOwners = new Map<string, string[]>();

  // Cross-check against the WHOLE catalog too, not just this batch — catches accidental reuse of
  // one of these new files by some unrelated existing product.
  const allProductsSnap = await db.collection('products').get();
  const productsById = new Map(allProductsSnap.docs.map((d) => [d.id, d.data()]));
  allProductsSnap.docs.forEach((doc) => {
    const images = (doc.data().images ?? []) as { url: string }[];
    images.forEach((img) => {
      if (!img.url) return;
      const owners = urlOwners.get(img.url) ?? [];
      owners.push(doc.id);
      urlOwners.set(img.url, owners);
    });
  });

  for (const item of CURATED_SHIRTS_TSHIRTS) {
    const folderPath = path.join(PUBLIC_DIR, 'images/products/men', item.folderKey);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      problems.push({ productId: item.displaySku, issue: `Image folder does not exist: images/products/men/${item.folderKey}` });
      continue;
    }

    const docId = `curated-${item.categorySlug}-${item.sku.toLowerCase()}`;
    const data = productsById.get(docId);
    if (!data) {
      problems.push({ productId: item.displaySku, issue: `No Firestore product found at products/${docId} — run npm run seed:curated-shirts-tshirts first.` });
      continue;
    }

    if (data.sku !== item.displaySku) {
      problems.push({ productId: item.displaySku, issue: `sku field is "${data.sku}", expected "${item.displaySku}".` });
    }
    if (!data.coverImage) problems.push({ productId: item.displaySku, issue: 'Missing coverImage.' });
    if (!data.thumbnailUrl) problems.push({ productId: item.displaySku, issue: 'Missing thumbnailUrl.' });

    const images = (data.images ?? []) as { url: string; color?: string }[];
    if (images.length === 0) {
      problems.push({ productId: item.displaySku, issue: 'No images[] entries at all.' });
      continue;
    }

    const expectedFragment = `/images/products/men/${item.folderKey}/`;
    images.forEach((img, idx) => {
      if (!img.url) {
        problems.push({ productId: item.displaySku, issue: `images[${idx}] has an empty url.` });
        return;
      }
      if (!decodeURIComponent(img.url).includes(expectedFragment)) {
        problems.push({ productId: item.displaySku, issue: `images[${idx}] does not point into ${expectedFragment}: ${img.url}` });
      }
      if (!fs.existsSync(urlToDiskPath(img.url))) {
        problems.push({ productId: item.displaySku, issue: `images[${idx}] file does not exist on disk: ${img.url}` });
      }
      if (img.color !== item.color) {
        problems.push({ productId: item.displaySku, issue: `images[${idx}].color is "${img.color}", expected "${item.color}".` });
      }
    });

    const variants = (data.variants ?? []) as { color?: string }[];
    variants.forEach((v, idx) => {
      if (v.color !== item.color) {
        problems.push({ productId: item.displaySku, issue: `variants[${idx}].color is "${v.color}", expected "${item.color}".` });
      }
    });
  }

  for (const [url, owners] of urlOwners) {
    const distinctOwners = [...new Set(owners)];
    if (distinctOwners.length > 1) {
      problems.push({ productId: distinctOwners.join(', '), issue: `Image "${url}" is referenced by more than one product — duplicate mapping.` });
    }
  }

  console.log(`Checked ${CURATED_SHIRTS_TSHIRTS.length} curated Shirts/T-Shirts items against ${allProductsSnap.size} total catalog products.\n`);

  if (problems.length === 0) {
    console.log('✔ All Shirts/T-Shirts image data is valid: every folder exists, every file exists on disk, every path is scoped to its own category, colors match exactly, no duplicate image mappings anywhere in the catalog.');
    return;
  }

  console.error(`✖ Found ${problems.length} problem(s):\n`);
  problems.forEach((p) => console.error(`  - [${p.productId}] ${p.issue}`));
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

/**
 * Repairs the exact data-integrity bug reported: a product's declared color (and therefore its
 * swatch/label) doesn't match what its photos actually show — e.g. a product tagged "Khaki" whose
 * images are hand-verified (src/lib/productImages.ts's REAL_PRODUCT_PHOTOGRAPHY) as depicting
 * Purple. This only happened to the generically-generated catalog (scripts/seedFirestore.ts used to
 * assign a random color name even when a photo's real color was already known) — never to the
 * curated FS031-073 batch, which was built directly from that same verified map.
 *
 * scripts/seedFirestore.ts is already fixed to consult the verified color going forward (see its
 * `verifiedColor` lookup) — this script repairs data that's already live in Firestore, in place:
 *
 *   - Product id, slug, created_at are NEVER touched (URLs, reviews, ratings, and orders all key off
 *     the doc id or are historical snapshots — none of them need or want this migration to touch them).
 *   - Only variants[].color/color_hex/sku, images[].color, and the tags array are corrected.
 *   - Inventory is untouched — variant ids (what stock is actually keyed by) don't change, only the
 *     color label on the variant that already owns that id.
 *   - A product whose images imply MORE THAN ONE verified color (shouldn't happen given one photo
 *     set per product, but checked defensively) is left alone except being hidden (`status:
 *     'hidden'`) and logged for manual review, per spec — never guessed.
 *
 * Usage: FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/migrateFormalShirtVariants.ts
 */
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { getVerifiedColorForCode, type VerifiedColor } from '../frontend/src/lib/productImages';
import { db } from './seedFirestore';

const CATEGORY_ID = 'cat-formal-shirts';

interface MigrationOutcome {
  productId: string;
  name: string;
  action: 'already-correct' | 'fixed' | 'flagged-for-review' | 'skipped-no-ground-truth';
  from?: string;
  to?: string;
  detail?: string;
}

function codeFromUrl(url: string): string | null {
  const match = url.match(/([A-Za-z]+\d+)-\d+\.\w+$/);
  return match ? match[1] : null;
}

/** Regenerates a generic-seed SKU's color segment (format `{BRAND}-{CAT}-{OLDCOLOR}-{SIZE...}`),
 *  leaving every other segment untouched. Falls back to appending the new color if the SKU doesn't
 *  match that expected shape (e.g. a seller-edited SKU) rather than guessing at structure. */
function reviseSku(oldSku: string, newColorName: string): string {
  const parts = oldSku.split('-');
  const newColorSegment = newColorName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
  if (parts.length >= 4) {
    return [parts[0], parts[1], newColorSegment, ...parts.slice(3)].join('-');
  }
  return `${oldSku}-${newColorSegment}`;
}

async function main() {
  console.log(`DressMart — migrating Formal Shirt color/variant data (category: ${CATEGORY_ID})\n`);

  const snap = await db.collection('products').where('category_id', '==', CATEGORY_ID).get();
  console.log(`Scanned ${snap.size} Formal Shirt products.\n`);

  const outcomes: MigrationOutcome[] = [];
  const bulkWriter = db.bulkWriter();
  let duplicateImagesRemoved = 0;
  let orphanImagesFound = 0;
  let duplicateVariantsFound = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as {
      name: string;
      variants: { id: string; size: string; color: string; color_hex: string; sku: string }[];
      images: { id: string; url: string; color: string | null; alt: string; sort_order: number }[];
      tags: string[];
    };

    // --- Dedupe images (defensive — not expected to find any, given one photo set per product) ---
    const seenUrls = new Set<string>();
    const dedupedImages = data.images.filter((img) => {
      if (seenUrls.has(img.url)) {
        duplicateImagesRemoved++;
        return false;
      }
      seenUrls.add(img.url);
      return true;
    });

    // --- Duplicate variants (same color+size) — defensive check ---
    const variantKeys = new Set<string>();
    data.variants.forEach((v) => {
      const key = `${v.color}::${v.size}`;
      if (variantKeys.has(key)) duplicateVariantsFound++;
      variantKeys.add(key);
    });

    // --- Determine verified truth from this product's own images ---
    const codes = [...new Set(dedupedImages.map((img) => codeFromUrl(img.url)).filter((c): c is string => Boolean(c)))];
    const verifiedColors = new Map<string, VerifiedColor>();
    codes.forEach((code) => {
      const v = getVerifiedColorForCode(code);
      if (v) verifiedColors.set(v.name, v);
    });

    if (verifiedColors.size === 0) {
      outcomes.push({ productId: doc.id, name: data.name, action: 'skipped-no-ground-truth', detail: `codes: ${codes.join(', ') || '(none)'}` });
      continue;
    }

    if (verifiedColors.size > 1) {
      // Ambiguous — this product's own photos imply more than one verified color, which should be
      // impossible given the one-photo-set-per-product seeding rule. Never guess; disable and flag.
      bulkWriter.update(doc.ref, { status: 'hidden', is_active: false, updated_at: new Date().toISOString() });
      outcomes.push({
        productId: doc.id,
        name: data.name,
        action: 'flagged-for-review',
        detail: `Images imply multiple verified colors: ${[...verifiedColors.keys()].join(', ')} — product hidden pending manual review.`,
      });
      continue;
    }

    const [verifiedColor] = verifiedColors.values();
    const declaredColors = new Set(data.variants.map((v) => v.color));

    // Orphan check: any image tagged with a color that isn't one of this product's own variant colors.
    dedupedImages.forEach((img) => {
      if (img.color && !declaredColors.has(img.color)) orphanImagesFound++;
    });

    if (declaredColors.size === 1 && declaredColors.has(verifiedColor.name)) {
      outcomes.push({ productId: doc.id, name: data.name, action: 'already-correct' });
      // Still write back deduped images if any were removed.
      if (dedupedImages.length !== data.images.length) {
        bulkWriter.update(doc.ref, { images: dedupedImages, updated_at: new Date().toISOString() });
      }
      continue;
    }

    // --- Fix: relabel every variant/image/tag from the old (wrong) color to the verified one ---
    const oldColorName = data.variants[0]?.color ?? '(unknown)';
    const fixedVariants = data.variants.map((v) => ({
      ...v,
      color: verifiedColor.name,
      color_hex: verifiedColor.hex,
      sku: reviseSku(v.sku, verifiedColor.name),
    }));
    const fixedImages = dedupedImages.map((img) => ({ ...img, color: verifiedColor.name }));
    const fixedTags = data.tags.map((t) => (t === oldColorName.toLowerCase() ? verifiedColor.name.toLowerCase() : t));

    bulkWriter.update(doc.ref, {
      variants: fixedVariants,
      images: fixedImages,
      tags: fixedTags,
      updated_at: new Date().toISOString(),
    });

    outcomes.push({ productId: doc.id, name: data.name, action: 'fixed', from: oldColorName, to: verifiedColor.name });
  }

  await bulkWriter.close();

  const fixed = outcomes.filter((o) => o.action === 'fixed');
  const alreadyCorrect = outcomes.filter((o) => o.action === 'already-correct');
  const flagged = outcomes.filter((o) => o.action === 'flagged-for-review');
  const skipped = outcomes.filter((o) => o.action === 'skipped-no-ground-truth');

  console.log('=== MIGRATION REPORT ===');
  fixed.forEach((o) => console.log(`  ~ FIXED  ${o.name}  (${o.from} -> ${o.to})`));
  flagged.forEach((o) => console.log(`  ! REVIEW ${o.name}  — ${o.detail}`));
  console.log('');
  console.log(`Total scanned:              ${outcomes.length}`);
  console.log(`Fixed:                       ${fixed.length}`);
  console.log(`Already correct:             ${alreadyCorrect.length}`);
  console.log(`Flagged for manual review:   ${flagged.length}`);
  console.log(`Skipped (no ground truth):   ${skipped.length}`);
  console.log(`Duplicate images removed:    ${duplicateImagesRemoved}`);
  console.log(`Orphan images found:         ${orphanImagesFound}`);
  console.log(`Duplicate variants found:    ${duplicateVariantsFound}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

/**
 * Full-catalog product image audit — scans every product in Firestore (not just one curated
 * batch, unlike scripts/validate*.ts), reads every image reference (coverImage, imageUrl,
 * thumbnailUrl, images[].url), and verifies each one actually resolves to a real file on disk
 * (frontend/public/…) — case-sensitively, since NTFS/Windows dev machines silently tolerate case
 * mismatches that a case-sensitive production host (Linux, most static hosts, GitHub Pages) won't.
 *
 * Also cross-checks a sample of results against a live Vite dev server's real HTTP status codes
 * (not just filesystem existence) when one is reachable, since that's the actual thing a broken
 * image manifests as in the browser.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/auditProductImages.ts            # report only
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/auditProductImages.ts --fix       # report + fix + rewrite
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/auditProductImages.ts --base-url http://localhost:5173
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getImageFolder, resolveProductImagePath, KNOWN_PLACEHOLDER_PATHS } from '../frontend/src/lib/productImages.js';
import { PRODUCT_IMAGE_MANIFEST } from '../frontend/src/data/productImageManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'frontend', 'public');
const PLACEHOLDER_PATH = KNOWN_PLACEHOLDER_PATHS[0]; // the generic one — used where a single fallback value is needed
const isKnownPlaceholder = (url: string): boolean => (KNOWN_PLACEHOLDER_PATHS as string[]).includes(url);

const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const baseUrlArg = args.find((a) => a.startsWith('--base-url='));
const BASE_URL = baseUrlArg ? baseUrlArg.split('=')[1] : 'http://localhost:5173';

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-dressmart';
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  color: string | null;
  sort_order: number;
}
interface ProductDoc {
  id: string;
  sku?: string;
  name?: string;
  category_id?: string;
  gender?: string;
  coverImage?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  images?: ProductImage[];
}

type Reason =
  | 'empty_images_array'
  | 'missing_file_no_source'
  | 'case_mismatch_folder'
  | 'case_mismatch_filename'
  | 'wrong_extension'
  | 'wrong_folder'
  | 'unexpected_url_format'
  | 'duplicate_within_product'
  | 'duplicate_across_products';

interface Finding {
  productId: string;
  field: string; // 'coverImage' | 'imageUrl' | 'thumbnailUrl' | 'images[i]'
  expectedPath: string;
  actualPath: string;
  reason: Reason;
  fix: string;
  /** The corrected URL to write back, if this finding is auto-fixable. Undefined = not fixable (report only). */
  correctedUrl?: string;
  /** For empty_images_array only — a full replacement images[] array (never a single URL). */
  correctedImages?: ProductImage[];
}

/** Matches "FS001-1.jpg" (index=1) and a bare "KS001.jpg" (index defaults to 1) — same convention
 *  every seed script in this repo uses to order a product's own gallery. */
const FILENAME_INDEX_PATTERN = /^[A-Za-z]+\d+(?:-(\d+))?\.(\w+)$/;
const FORMAT_PRIORITY: Record<string, number> = { jpg: 0, jpeg: 0, png: 1, webp: 2, avif: 3 };

/** Attempts to recover a product's gallery from real on-disk photography via the same manifest the
 *  seed scripts use — keyed by this product's own `sku` and resolved category folder. Returns null
 *  if no real photos exist for this sku (a genuine content gap, not a bug — falls back to the
 *  placeholder instead of fabricating anything). */
function recoverImagesFromManifest(product: ProductDoc): ProductImage[] | null {
  if (!product.gender || !product.category_id || !product.sku) return null;
  const categorySlug = product.category_id.replace(/^cat-/, '');
  const folder = getImageFolder(categorySlug);
  const files: string[] = (PRODUCT_IMAGE_MANIFEST as Record<string, Record<string, Record<string, string[]>>>)[product.gender]?.[folder]?.[product.sku] ?? [];
  if (files.length === 0) return null;

  const byIndex = new Map<number, { file: string; priority: number }>();
  for (const file of files) {
    const match = FILENAME_INDEX_PATTERN.exec(file);
    if (!match) continue;
    const index = match[1] ? Number(match[1]) : 1;
    const ext = match[2].toLowerCase();
    const priority = FORMAT_PRIORITY[ext] ?? 99;
    const existing = byIndex.get(index);
    if (!existing || priority < existing.priority) byIndex.set(index, { file, priority });
  }
  const ordered = [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, v]) => v.file);
  if (ordered.length === 0) return null;

  const color = product.images?.[0]?.color ?? null;
  return ordered.map((file, idx) => ({
    id: `${product.id}-img-${idx}`,
    url: resolveProductImagePath(product.gender as 'men' | 'kids', categorySlug, file),
    alt: `${product.name ?? product.id} — photo ${idx + 1}`,
    color,
    sort_order: idx,
  }));
}

/** Decodes a `/images/products/<gender>/<folder>/<filename>` URL into its parts, or null if it
 *  doesn't match that convention at all (e.g. a real Firebase Storage URL, or something malformed). */
function parseProductImageUrl(url: string): { gender: string; folder: string; filename: string } | null {
  const match = /^\/images\/products\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(url);
  if (!match) return null;
  return { gender: decodeURIComponent(match[1]), folder: decodeURIComponent(match[2]), filename: decodeURIComponent(match[3]) };
}

/** Case-sensitive directory listing, cached per directory since the same folder is checked
 *  hundreds of times across a full-catalog audit. */
const dirListingCache = new Map<string, string[] | null>();
function listDir(dirPath: string): string[] | null {
  if (dirListingCache.has(dirPath)) return dirListingCache.get(dirPath)!;
  let entries: string[] | null;
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    entries = null;
  }
  dirListingCache.set(dirPath, entries);
  return entries;
}

function baseNameNoExt(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? filename : filename.slice(0, idx);
}

/** Verifies one `/images/products/...` URL against disk, case-sensitively. Returns either 'ok' or
 *  a specific broken-reason plus (when determinable) the corrected URL. Never fabricates a file
 *  that doesn't exist — 'missing_file_no_source' is reported, not silently papered over. */
function checkImagePath(url: string): { ok: true } | { ok: false; reason: Reason; correctedUrl?: string } {
  if (isKnownPlaceholder(url)) return { ok: true }; // intentional, not a bug

  const parsed = parseProductImageUrl(url);
  if (!parsed) return { ok: false, reason: 'unexpected_url_format' };
  const { gender, folder, filename } = parsed;

  const genderDir = path.join(PUBLIC_DIR, 'images', 'products', gender);
  const genderEntries = listDir(genderDir);
  if (!genderEntries) return { ok: false, reason: 'wrong_folder' }; // gender itself doesn't exist — can't recover

  const exactFolderMatch = genderEntries.includes(folder);
  const caseInsensitiveFolderMatch = genderEntries.find((d) => d.toLowerCase() === folder.toLowerCase());

  if (!exactFolderMatch && !caseInsensitiveFolderMatch) {
    return { ok: false, reason: 'wrong_folder' }; // no such folder in any case — not auto-fixable without knowing the intended one
  }

  const realFolder = exactFolderMatch ? folder : caseInsensitiveFolderMatch!;
  const folderEntries = listDir(path.join(genderDir, realFolder)) ?? [];

  const exactFileMatch = folderEntries.includes(filename);
  if (exactFileMatch && exactFolderMatch) return { ok: true };

  if (exactFileMatch && !exactFolderMatch) {
    // File exists, just under a differently-cased folder name.
    return { ok: false, reason: 'case_mismatch_folder', correctedUrl: `/images/products/${encodeURIComponent(gender)}/${encodeURIComponent(realFolder)}/${encodeURIComponent(filename)}` };
  }

  const caseInsensitiveFileMatch = folderEntries.find((f) => f.toLowerCase() === filename.toLowerCase());
  if (caseInsensitiveFileMatch) {
    return {
      ok: false,
      reason: 'case_mismatch_filename',
      correctedUrl: `/images/products/${encodeURIComponent(gender)}/${encodeURIComponent(realFolder)}/${encodeURIComponent(caseInsensitiveFileMatch)}`,
    };
  }

  const sameBasenameDifferentExt = folderEntries.find((f) => baseNameNoExt(f).toLowerCase() === baseNameNoExt(filename).toLowerCase());
  if (sameBasenameDifferentExt) {
    return {
      ok: false,
      reason: 'wrong_extension',
      correctedUrl: `/images/products/${encodeURIComponent(gender)}/${encodeURIComponent(realFolder)}/${encodeURIComponent(sameBasenameDifferentExt)}`,
    };
  }

  return { ok: false, reason: 'missing_file_no_source' }; // genuinely no matching file on disk at all
}

async function main() {
  console.log(`DressMart — full product image audit (project "${projectId}")\n`);

  const snap = await db.collection('products').get();
  console.log(`Scanned ${snap.size} products.\n`);

  const findings: Finding[] = [];
  const urlToProductIds = new Map<string, Set<string>>(); // for cross-product duplicate detection

  for (const doc of snap.docs) {
    const product = { id: doc.id, ...doc.data() } as ProductDoc;
    const images = product.images ?? [];

    if (images.length === 0) {
      const recovered = recoverImagesFromManifest(product);
      findings.push({
        productId: product.id,
        field: 'images[]',
        expectedPath: '(at least one image)',
        actualPath: '(empty array)',
        reason: 'empty_images_array',
        fix: recovered
          ? `Real on-disk photography found for sku ${product.sku} — restore ${recovered.length} image(s) from the manifest.`
          : `No real photography found for sku ${product.sku ?? '(none)'} — set a single placeholder entry consistently with coverImage/imageUrl/thumbnailUrl.`,
        correctedImages: recovered ?? [
          {
            id: `${product.id}-img-0`,
            url: PLACEHOLDER_PATH,
            alt: `${product.name ?? product.id} — image pending`,
            color: null,
            sort_order: 0,
          },
        ],
      });
    }

    // Duplicate-within-product check (same URL twice in one product's own gallery).
    const seenInThisProduct = new Set<string>();
    images.forEach((img, idx) => {
      if (isKnownPlaceholder(img.url)) return;
      if (seenInThisProduct.has(img.url)) {
        findings.push({
          productId: product.id,
          field: `images[${idx}]`,
          expectedPath: '(a distinct photo)',
          actualPath: img.url,
          reason: 'duplicate_within_product',
          fix: 'Remove the duplicate gallery entry.',
        });
      }
      seenInThisProduct.add(img.url);

      // Known placeholders are *meant* to be shared by every photo-less product in their category
      // (that's the entire point of a fallback image) — only real photos count for this check.
      if (isKnownPlaceholder(img.url)) return;
      const ids = urlToProductIds.get(img.url) ?? new Set<string>();
      ids.add(product.id);
      urlToProductIds.set(img.url, ids);
    });

    // Per-field existence/correctness checks.
    const fieldsToCheck: [string, string | undefined][] = [
      ['coverImage', product.coverImage],
      ['imageUrl', product.imageUrl],
      ['thumbnailUrl', product.thumbnailUrl],
      ...images.map((img, idx) => [`images[${idx}]`, img.url] as [string, string]),
    ];

    for (const [field, url] of fieldsToCheck) {
      if (!url) continue;
      const result = checkImagePath(url);
      if (result.ok) continue;
      const parsed = parseProductImageUrl(url);
      const expected = parsed ? `/images/products/${parsed.gender}/${parsed.folder}/${parsed.filename}` : '(not a recognized /images/products/... path)';
      findings.push({
        productId: product.id,
        field,
        expectedPath: expected,
        actualPath: url,
        reason: result.reason,
        fix:
          result.reason === 'case_mismatch_folder'
            ? `Rewrite to the real on-disk folder casing: ${result.correctedUrl}`
            : result.reason === 'case_mismatch_filename'
              ? `Rewrite to the real on-disk filename casing: ${result.correctedUrl}`
              : result.reason === 'wrong_extension'
                ? `Rewrite to the real on-disk extension: ${result.correctedUrl}`
                : result.reason === 'wrong_folder'
                  ? 'No folder matches even case-insensitively — needs a corrected category_id → folder mapping, not a rename.'
                  : result.reason === 'unexpected_url_format'
                    ? 'Not a /images/products/... path (checked for a real Firebase Storage URL/other format) — needs manual review.'
                    : 'No real photography exists on disk for this product/category — set to the placeholder explicitly rather than leaving a 404.',
        correctedUrl: result.reason === 'missing_file_no_source' ? PLACEHOLDER_PATH : result.correctedUrl,
      });
    }
  }

  // Cross-product duplicate detection (same real photo claimed by two different products).
  for (const [url, ids] of urlToProductIds) {
    if (ids.size > 1) {
      for (const id of ids) {
        findings.push({
          productId: id,
          field: 'images[]',
          expectedPath: '(a photo unique to this product)',
          actualPath: url,
          reason: 'duplicate_across_products',
          fix: `Shared with ${ids.size - 1} other product(s): ${[...ids].filter((i) => i !== id).join(', ')}. Needs re-seeding with the correct claimed-codes exclusion, not a per-doc rename.`,
        });
      }
    }
  }

  // --- Report ---------------------------------------------------------------------------------
  const byReason = new Map<Reason, number>();
  findings.forEach((f) => byReason.set(f.reason, (byReason.get(f.reason) ?? 0) + 1));

  console.log('=== FINDINGS BY CATEGORY ===');
  for (const [reason, count] of byReason) console.log(`  ${reason}: ${count}`);
  console.log(`  TOTAL findings: ${findings.length}\n`);

  console.log('=== DETAILED REPORT (first 100 shown; full list in the .md report) ===');
  console.log('Product ID | Field | Expected Path | Actual Path | Reason | Fix');
  findings.slice(0, 100).forEach((f) => {
    console.log(`${f.productId} | ${f.field} | ${f.expectedPath} | ${f.actualPath} | ${f.reason} | ${f.fix}`);
  });

  const reportPath = path.join(ROOT, 'documentation', 'image-audit-report.md');
  const reportLines = [
    '# Product Image Audit Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Products scanned: ${snap.size}`,
    `Total findings: ${findings.length}`,
    '',
    '## Findings by category',
    '',
    ...[...byReason.entries()].map(([reason, count]) => `- **${reason}**: ${count}`),
    '',
    '## Full detail',
    '',
    '| Product ID | Field | Expected Path | Actual Path | Reason | Fix |',
    '|---|---|---|---|---|---|',
    ...findings.map((f) => `| ${f.productId} | ${f.field} | ${f.expectedPath} | ${f.actualPath} | ${f.reason} | ${f.fix.replace(/\|/g, '\\|')} |`),
  ];
  fs.writeFileSync(reportPath, reportLines.join('\n') + '\n');
  console.log(`\nFull report written to ${path.relative(ROOT, reportPath)}`);

  // --- Fix pass ---------------------------------------------------------------------------------
  if (shouldFix) {
    console.log('\n=== APPLYING FIXES ===');
    const fixable = findings.filter((f) => (f.correctedUrl || f.correctedImages) && f.reason !== 'duplicate_within_product' && f.reason !== 'duplicate_across_products');
    const byProduct = new Map<string, Finding[]>();
    fixable.forEach((f) => {
      const list = byProduct.get(f.productId) ?? [];
      list.push(f);
      byProduct.set(f.productId, list);
    });

    let fixedCount = 0;
    const bulkWriter = db.bulkWriter();
    for (const [productId, productFindings] of byProduct) {
      const docRef = db.collection('products').doc(productId);
      const doc = await docRef.get();
      if (!doc.exists) continue;
      const data = doc.data() as ProductDoc;
      let images = [...(data.images ?? [])];

      let coverImage = data.coverImage;
      let imageUrl = data.imageUrl;
      let thumbnailUrl = data.thumbnailUrl;

      for (const f of productFindings) {
        if (f.field === 'images[]' && f.correctedImages) {
          images = f.correctedImages; // whole-array replacement (empty_images_array recovery)
        } else if (f.field.startsWith('images[')) {
          const idx = Number(f.field.slice(7, -1));
          if (images[idx]) images[idx] = { ...images[idx], url: f.correctedUrl! };
        } else if (f.field === 'coverImage') coverImage = f.correctedUrl;
        else if (f.field === 'imageUrl') imageUrl = f.correctedUrl;
        else if (f.field === 'thumbnailUrl') thumbnailUrl = f.correctedUrl;
      }

      // Keep the three top-level convenience fields consistent with images[0] whenever that
      // specific field wasn't itself independently broken (mirrors how every seed script already
      // derives them: coverImage = imageUrl = thumbnailUrl = images[0].url).
      const firstImageUrl = images[0]?.url;
      if (firstImageUrl) {
        if (!productFindings.some((f) => f.field === 'coverImage')) coverImage = firstImageUrl;
        if (!productFindings.some((f) => f.field === 'imageUrl')) imageUrl = firstImageUrl;
        if (!productFindings.some((f) => f.field === 'thumbnailUrl')) thumbnailUrl = firstImageUrl;
      }

      bulkWriter.update(docRef, { images, coverImage, imageUrl, thumbnailUrl });
      fixedCount++;
    }
    await bulkWriter.close();
    console.log(`Fixed ${fixedCount} product(s) (${fixable.length} individual field corrections).`);
  }

  // --- Live HTTP verification -------------------------------------------------------------------
  console.log(`\n=== LIVE HTTP CHECK against ${BASE_URL} ===`);
  const allUrls = new Set<string>();
  snap.docs.forEach((doc) => {
    const p = doc.data() as ProductDoc;
    [p.coverImage, p.imageUrl, p.thumbnailUrl, ...(p.images ?? []).map((i) => i.url)].forEach((u) => u && allUrls.add(u));
  });

  const urls = [...allUrls];
  let ok200 = 0;
  let notOk = 0;
  const failures: { url: string; status: number | string }[] = [];
  const CONCURRENCY = 20;
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      try {
        const res = await fetch(BASE_URL + url, { method: 'GET' });
        if (res.status === 200) ok200++;
        else {
          notOk++;
          failures.push({ url, status: res.status });
        }
      } catch (error) {
        notOk++;
        failures.push({ url, status: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    console.log(`Unique image URLs checked: ${urls.length}`);
    console.log(`  200 OK: ${ok200}`);
    console.log(`  Not OK: ${notOk}`);
    if (failures.length > 0) {
      console.log('\nFirst 30 non-200 URLs:');
      failures.slice(0, 30).forEach((f) => console.log(`  [${f.status}] ${f.url}`));
    }
  } catch (error) {
    console.log(`Live HTTP check skipped — could not reach ${BASE_URL}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

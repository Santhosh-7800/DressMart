/**
 * Script to remove the 30 curated checked shirt products (curated-checked-cs001 to cs030)
 * that use SVG placeholder vector artwork instead of real photos from Firestore.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/removeCuratedCheckedShirts.ts
 */
import 'dotenv/config';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-dressmart';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';

process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID });
}

const db = getFirestore();

export async function main() {
  console.log(`DressMart — Removing SVG/curated checked shirt products from Firestore...`);

  // Query products collection for docs with ID starting with curated-checked- or coverImage containing .svg
  const productsSnap = await db.collection('products').get();
  const bulkWriter = db.bulkWriter();

  let removedCount = 0;

  for (const docSnap of productsSnap.docs) {
    const data = docSnap.data();
    const id = docSnap.id;
    const coverImage = (data.coverImage as string) || '';
    const imageUrl = (data.imageUrl as string) || '';
    const sku = (data.sku as string) || '';

    const isCuratedChecked =
      id.startsWith('curated-checked-') ||
      coverImage.endsWith('.svg') ||
      imageUrl.endsWith('.svg') ||
      (sku.startsWith('CS') && !sku.startsWith('CHS'));

    if (isCuratedChecked) {
      console.log(`Removing product: [${id}] ${data.name} (${sku})`);
      bulkWriter.delete(docSnap.ref);
      bulkWriter.delete(db.collection('inventory').doc(id));
      removedCount++;
    }
  }

  await bulkWriter.close();
  console.log(`\n✔ Successfully removed ${removedCount} SVG/curated checked shirt product(s).`);
}

main().catch((error) => {
  console.error('Error removing curated checked shirts:', error);
  process.exit(1);
});

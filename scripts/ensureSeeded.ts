/**
 * Automatic "never show an empty catalog" guard for local development.
 *
 * Runs automatically before `npm run dev` (see package.json's "predev"). Checks whether the
 * `products` collection already has data; if it's empty (e.g. the Firestore emulator was restarted
 * and lost its in-memory state before it could export), it re-runs the full seed pipeline —
 * scripts/seedFirestore.ts's generic catalog, then scripts/seedCuratedFormalShirts.ts's curated
 * FS031-073 batch — automatically, with no manual `npm run seed` step required.
 *
 * Deliberately NOT wired into `npm run build`/`preview`, and deliberately does NOT run against a
 * real production project: seeding a live marketplace with synthetic demo data automatically would
 * be actively wrong (a real, empty catalog just means no sellers have listed anything yet — that's
 * a legitimate state the UI should show as "no products yet", not paper over with fake products).
 * This script only acts when FIRESTORE_EMULATOR_HOST is set (or defaults to the local emulator) —
 * see the guard below.
 *
 * Fails soft: if the emulator isn't reachable yet (e.g. you ran `npm run dev` before
 * `npm run emulators`), this logs a warning and lets `npm run dev` continue rather than blocking it —
 * the app's own empty/offline-state UI (see src/hooks/useCatalogHealth.ts) takes over from there.
 */
import 'dotenv/config';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';

async function main() {
  // Only ever auto-seed against the local emulator — never a real project, even if
  // GOOGLE_APPLICATION_CREDENTIALS happens to be set in the shell (predev is a dev-only hook).
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-dressmart';
  if (!getApps().length) initializeApp({ projectId });
  const db = getFirestore();

  try {
    const snap = await db.collection('products').limit(1).get();
    if (!snap.empty) {
      console.log('✔ Catalog check: products already exist — skipping auto-seed.');
      return;
    }
  } catch (error) {
    console.warn(
      `\n⚠ Catalog check skipped — couldn't reach the Firestore emulator at ${EMULATOR_HOST}.\n` +
        '  If this is a fresh setup, start it first: npm run emulators (in another terminal), then restart npm run dev.\n' +
        `  (${error instanceof Error ? error.message : String(error)})\n`,
    );
    return;
  }

  console.log('⚠ Products collection is empty — auto-seeding the catalog now (this only happens once)...\n');
  const [{ main: seedCatalog }, { main: seedCuratedFormalShirts }] = await Promise.all([
    import('./seedFirestore'),
    import('./seedCuratedFormalShirts'),
  ]);
  await seedCatalog();
  await seedCuratedFormalShirts();
  console.log('\n✔ Auto-seed complete — the catalog is ready.');
}

main().catch((error) => {
  // Never block `npm run dev` over this — log loudly and move on.
  console.error('⚠ Auto-seed encountered an error (continuing anyway):', error);
});

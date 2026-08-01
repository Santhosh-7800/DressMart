/**
 * Reusable "never show an empty catalog" guard — checks whether Firestore's `products` collection
 * has data and, if not, runs the full seed pipeline exactly once: scripts/seedFirestore.ts's
 * generic catalog, scripts/seedCuratedFormalShirts.ts's curated FS031-073 batch,
 * scripts/seedCuratedShirtsTshirts.ts's curated Shirts/T-Shirts batch,
 * scripts/seedCuratedApparel.ts's curated Bottom Wear/Outerwear/Ethnic Wear/Innerwear/Belts/Vests
 * batch, and scripts/seedCuratedKids.ts's curated Kids batch (T-Shirts, Shorts, Hoodies, Shirts,
 * Jeans, Party Wear, Joggers, Jackets, School Uniform).
 *
 * Two callers use this, and they never overlap in practice (predev's one-shot Node process always
 * exits before the Vite dev server that hosts the other caller starts listening) but both route
 * through the same in-flight lock anyway, since it's cheap insurance against the one real hazard:
 * scripts/seedFirestore.ts mints random Firestore doc IDs for its generic catalog (no natural key
 * to upsert against), so two concurrent full-pipeline runs against an empty collection would double
 * up every generated product instead of one being a no-op.
 *  - scripts/ensureSeeded.ts — the `predev` CLI hook.
 *  - scripts/vite/devSeedPlugin.ts's `/__dev/ensure-seeded` endpoint — the in-browser safety net for
 *    when the emulator is restarted (and loses its data) while `npm run dev` is already running.
 *
 * Deliberately only ever targets the local Firestore emulator (see EnsureSeededOptions.emulatorHost)
 * — never a real project, even if GOOGLE_APPLICATION_CREDENTIALS happens to be set in the shell.
 *
 * Checks `_meta/catalog_seed`'s `demoSeedDisabled` field before anything else — set once you've
 * deliberately emptied the demo catalog (e.g. to replace it with real products) so it doesn't get
 * silently refilled the next time `npm run dev` runs. An empty `products` collection alone isn't
 * enough signal for that: it's also the state of a genuinely fresh checkout, where auto-seeding is
 * exactly the right thing to do.
 */
import 'dotenv/config';

export type SeedOutcome = 'already-seeded' | 'seeded' | 'unreachable' | 'demo-seed-disabled';

export interface SeedCheckResult {
  outcome: SeedOutcome;
  error?: string;
}

export interface EnsureSeededOptions {
  /** Firestore emulator host:port to target (matches firebase.json's firestore emulator port). */
  emulatorHost?: string;
  /** How long to keep retrying while the emulator isn't reachable yet, in ms. */
  waitForEmulatorMs?: number;
  /** Delay between reachability retries, in ms. */
  retryDelayMs?: number;
  /** Silence non-essential logs (the caller has its own logging, e.g. an HTTP response body). */
  quiet?: boolean;
}

const DEFAULT_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';

let inFlight: Promise<SeedCheckResult> | null = null;

export async function ensureSeeded(options: EnsureSeededOptions = {}): Promise<SeedCheckResult> {
  if (inFlight) return inFlight;
  inFlight = run(options);
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run({
  emulatorHost = DEFAULT_EMULATOR_HOST,
  waitForEmulatorMs = 25_000,
  retryDelayMs = 1500,
  quiet = false,
}: EnsureSeededOptions): Promise<SeedCheckResult> {
  // Only ever auto-seed against the local emulator — never a real project, even if
  // GOOGLE_APPLICATION_CREDENTIALS happens to be set in the shell (this is a dev-only hook).
  process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-dressmart';
  if (!getApps().length) initializeApp({ projectId });
  const db = getFirestore();

  const deadline = Date.now() + waitForEmulatorMs;
  let lastError = '';
  // Poll until the emulator is reachable (it may still be booting) or the deadline passes —
  // this is what actually closes the "predev ran before the emulator finished starting" race.
  for (;;) {
    try {
      // Deliberately emptied on purpose (see _meta/catalog_seed) — e.g. real products are about to
      // replace the demo catalog via the Seller Dashboard. An empty `products` collection alone
      // isn't enough signal to skip seeding (that's also true on a completely fresh checkout, where
      // auto-seeding is exactly what should happen), so this sentinel is what tells them apart.
      const sentinel = await db.collection('_meta').doc('catalog_seed').get();
      if (sentinel.exists && sentinel.data()?.demoSeedDisabled) {
        if (!quiet) {
          console.log(
            '✔ Demo auto-seed is disabled (_meta/catalog_seed.demoSeedDisabled) — leaving the ' +
              'catalog as-is instead of refilling it. Delete that field/doc to re-enable.',
          );
        }
        return { outcome: 'demo-seed-disabled' };
      }

      const snap = await db.collection('products').limit(1).get();
      if (!snap.empty) {
        if (!quiet) console.log('✔ Catalog check: products already exist — skipping auto-seed.');
        return { outcome: 'already-seeded' };
      }
      break; // reachable and empty — fall through to seeding.
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (Date.now() >= deadline) {
        if (!quiet) {
          console.warn(
            `\n⚠ Catalog check skipped — couldn't reach the Firestore emulator at ${emulatorHost} after ${waitForEmulatorMs}ms.\n` +
              '  Start it with `npm run emulators` (or just `npm run dev`, which now starts it automatically).\n' +
              `  (${lastError})\n`,
          );
        }
        return { outcome: 'unreachable', error: lastError };
      }
      await sleep(retryDelayMs);
    }
  }

  if (!quiet) console.log('⚠ Products collection is empty — auto-seeding the catalog now (this only happens once)...\n');
  await runSeedPipeline();
  if (!quiet) console.log('\n✔ Auto-seed complete — the catalog is ready.');
  return { outcome: 'seeded' };
}

async function runSeedPipeline(): Promise<void> {
  const [{ main: seedCatalog }, { main: seedCuratedFormalShirts }, { main: seedCuratedShirtsTshirts }, { main: seedCuratedApparel }, { main: seedCuratedKids }] =
    await Promise.all([
      import('../seedFirestore.js'),
      import('../seedCuratedFormalShirts.js'),
      import('../seedCuratedShirtsTshirts.js'),
      import('../seedCuratedApparel.js'),
      import('../seedCuratedKids.js'),
    ]);
  await seedCatalog();
  await seedCuratedFormalShirts();
  await seedCuratedShirtsTshirts();
  await seedCuratedApparel();
  await seedCuratedKids();
}

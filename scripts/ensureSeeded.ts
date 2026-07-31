/**
 * Automatic "never show an empty catalog" guard for local development — runs before `npm run dev`
 * (see package.json's "predev", right after scripts/ensureEmulatorRunning.ts). The actual
 * check-and-seed logic lives in scripts/lib/ensureSeededCore.ts so the same code can also run
 * inside the Vite dev server (scripts/vite/devSeedPlugin.ts) as an in-browser safety net.
 *
 * Fails soft: never blocks `npm run dev` over a seeding problem — the app's own empty/offline-state
 * UI (see src/hooks/useCatalogHealth.ts) takes over from there.
 */
import { ensureSeeded } from './lib/ensureSeededCore.js';

ensureSeeded().catch((error) => {
  console.error('⚠ Auto-seed encountered an error (continuing anyway):', error);
});

/**
 * Dev-only safety net for the one race scripts/ensureEmulatorRunning.ts + scripts/ensureSeeded.ts
 * (predev) can't cover: the Firestore emulator getting restarted — and losing its in-memory data —
 * while `npm run dev` is already running and a browser tab is still open. Exposes a same-origin
 * endpoint (see src/hooks/useCatalogHealth.ts) the client can call to trigger the same
 * seed-if-empty check predev runs, so the app can heal itself without a manual reseed step.
 *
 * `apply: 'serve'` means this plugin — and its firebase-admin import chain — only ever loads when
 * running the Vite dev server. It is entirely absent from `vite build`, so it never ships in the
 * production/Play Store bundle.
 */
import type { Plugin } from 'vite';
import { ensureSeeded } from '../lib/ensureSeededCore.js';

export function devSeedPlugin(): Plugin {
  return {
    name: 'dressmart-dev-seed',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/ensure-seeded', (req, res) => {
        ensureSeeded({ quiet: true })
          .then((result) => {
            res.statusCode = result.outcome === 'unreachable' ? 503 : 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          })
          .catch((error: unknown) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ outcome: 'error', error: error instanceof Error ? error.message : String(error) }));
          });
      });
    },
  };
}

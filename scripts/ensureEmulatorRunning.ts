/**
 * Automatic emulator autostart for local development — runs before `npm run dev` (see
 * package.json's "predev"). Removes the "start the emulator in a second terminal before you start
 * the app" step entirely: if the Firestore emulator port is already open, this no-ops (never spawns
 * a second, duplicate emulator instance); otherwise it starts `firebase emulators:start` detached
 * so it keeps running for the whole dev session, and waits for it to come up before continuing.
 *
 * Deliberately skipped when the app is configured to talk to a real Firebase project (see
 * usingEmulator() below, which mirrors src/lib/env.ts's logic) — this is a dev-only convenience,
 * never something that should run against/instead of production credentials.
 *
 * Fails soft: never blocks `npm run dev` — if the emulator doesn't come up in time, the app's own
 * offline-state UI (src/hooks/useCatalogHealth.ts) takes over, same as before this script existed.
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import net from 'node:net';

const FIRESTORE_PORT = 8081;
const HOST = 'localhost';
const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1000;

function usingEmulator(): boolean {
  const apiKey = process.env.VITE_FIREBASE_API_KEY || '';
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || '';
  const hasRealCredentials = Boolean(apiKey && projectId && !apiKey.includes('your-') && !projectId.includes('your-'));
  return process.env.VITE_USE_FIREBASE_EMULATOR === 'true' || !hasRealCredentials;
}

function isPortOpen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const finish = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function waitForFirestore(deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await isPortOpen(FIRESTORE_PORT, HOST)) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
}

async function main() {
  if (!usingEmulator()) {
    console.log('✔ Using a real Firebase project — skipping local emulator autostart.');
    return;
  }

  if (await isPortOpen(FIRESTORE_PORT, HOST)) {
    console.log('✔ Firestore emulator already running — reusing it.');
    return;
  }

  console.log('⚠ Firestore emulator not running — starting it automatically...');
  // firebase.json AND .firebaserc both live in database/ (see the repo restructure) — verified
  // empirically that Firebase CLI resolves .firebaserc relative to firebase.json's own directory,
  // not via an independent upward search from cwd, so the two must stay colocated. .emulator-data
  // stays at the repo root, so --import/--export-on-exit stay relative to this script's own cwd
  // (the repo root), unaffected by --config pointing elsewhere.
  //
  // shell: true is required on Windows to spawn the `firebase.cmd` shim directly (without it, Node
  // throws `spawn EINVAL` for .cmd files) — args stay a properly-escaped array rather than a
  // concatenated string, and every argument here is a static literal, so this isn't a shell-
  // injection risk despite Node's generic shell:true deprecation warning about unescaped args.
  const child = spawn(
    'firebase',
    ['--config', 'database/firebase.json', 'emulators:start', '--import=./.emulator-data', '--export-on-exit=./.emulator-data'],
    { detached: true, stdio: 'ignore', shell: true },
  );
  child.unref();

  const ready = await waitForFirestore(Date.now() + READY_TIMEOUT_MS);
  if (!ready) {
    console.warn(
      `⚠ Emulator didn't come up within ${READY_TIMEOUT_MS / 1000}s — continuing anyway; ` +
        "the app will show a retry screen if Firestore stays unreachable.",
    );
    return;
  }
  console.log('✔ Firestore emulator is up.');
}

main().catch((error) => {
  console.error('⚠ Emulator autostart failed (continuing anyway):', error);
});

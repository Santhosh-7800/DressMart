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
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

const FIRESTORE_PORT = 8081;
const HOST = 'localhost';
const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1000;

// Real, direct JS entry point for the local `tsx` devDependency — spawning this straight with
// `node` (no shell) means Windows never gets a `cmd.exe`/`npx.cmd` layer to pop a console window
// for, which `shell: true` + `windowsHide: true` turned out not to reliably suppress.
const TSX_CLI = path.join(process.cwd(), 'node_modules/tsx/dist/cli.mjs');

/** Resolves a *globally* npm-installed CLI's real JS entry point (e.g. firebase-tools, installed
 *  globally rather than as a project dependency) so it too can be spawned directly with `node`
 *  instead of through its `.cmd` shim — same window-suppression reasoning as TSX_CLI above.
 *  Returns null if anything about the lookup fails, so callers can fall back to the shell-based
 *  invocation rather than break emulator autostart entirely on an unusual global-install layout. */
function resolveGlobalBin(packageRelPath: string): string | null {
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true }).trim();
    const resolved = path.join(globalRoot, packageRelPath);
    return fs.existsSync(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

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

/** Spawns the periodic safety-net exporter (scripts/autoExportEmulator.ts) — detached, so it
 *  outlives this script and keeps running for as long as the emulator does. Safe to call every
 *  time `npm run dev` starts, even when the emulator was already running from an earlier session:
 *  the exporter's own PID lockfile makes a duplicate instance a no-op. */
function startAutoExporter(): void {
  // Spawns `node` directly on TSX_CLI (see above) instead of `npx tsx ...` through a shell — no
  // cmd.exe/npx.cmd layer means no console window for Windows to pop open, full stop. (An earlier
  // version of this tried shell:true + windowsHide:true; that combination turned out not to
  // reliably suppress the window for a *detached* child, which is exactly the case here.)
  const child = spawn(process.execPath, [TSX_CLI, 'scripts/autoExportEmulator.ts'], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

async function main() {
  if (!usingEmulator()) {
    console.log('✔ Using a real Firebase project — skipping local emulator autostart.');
    return;
  }

  if (await isPortOpen(FIRESTORE_PORT, HOST)) {
    console.log('✔ Firestore emulator already running — reusing it.');
    startAutoExporter();
    return;
  }

  console.log('⚠ Firestore emulator not running — starting it automatically...');
  // firebase.json AND .firebaserc both live in database/ (see the repo restructure) — verified
  // empirically that Firebase CLI resolves .firebaserc relative to firebase.json's own directory,
  // not via an independent upward search from cwd, so the two must stay colocated. .emulator-data
  // stays at the repo root, so --import/--export-on-exit stay relative to this script's own cwd
  // (the repo root), unaffected by --config pointing elsewhere.
  //
  // Same direct-node-invocation approach as startAutoExporter() — resolve the real firebase-tools
  // entry point (it's a global install here, not a project dependency, hence resolveGlobalBin
  // rather than a fixed node_modules-relative path) and spawn `node` on it directly, with no shell
  // in between to pop a console window open. Falls back to the old shell:true path (still
  // windowsHide:true, best effort) only if that resolution fails — e.g. firebase-tools installed
  // in some other, unanticipated way — so emulator autostart never breaks outright over this.
  const firebaseEntry = resolveGlobalBin('firebase-tools/lib/bin/firebase.js');
  const emulatorArgs = ['--config', 'database/firebase.json', 'emulators:start', '--import=./.emulator-data', '--export-on-exit=./.emulator-data'];
  const child = firebaseEntry
    ? spawn(process.execPath, [firebaseEntry, ...emulatorArgs], { detached: true, stdio: 'ignore', windowsHide: true })
    : spawn('firebase', emulatorArgs, { detached: true, stdio: 'ignore', shell: true, windowsHide: true });
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
  startAutoExporter();
}

main().catch((error) => {
  console.error('⚠ Emulator autostart failed (continuing anyway):', error);
});

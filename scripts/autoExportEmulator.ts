/**
 * Periodic safety-net export for the local Firestore emulator — spawned detached by
 * ensureEmulatorRunning.ts and left running for the emulator's whole lifetime.
 *
 * The emulator is started with `--export-on-exit=./.emulator-data`, but that only fires on a
 * *graceful* shutdown of that exact process. Since ensureEmulatorRunning.ts spawns it detached
 * and invisible (no console window to Ctrl+C), the only realistic ways most people actually stop
 * it are killing it via Task Manager or rebooting the machine — both skip the export-on-exit hook
 * entirely, silently discarding every write made since the last successful export. This is a
 * complete, self-contained explanation for "I added data today, it's gone tomorrow" in local dev,
 * independent of anything in the app's own Firestore usage.
 *
 * Fix: export on a timer instead of relying on a clean exit at all. Worst case, a hard kill or
 * reboot loses only the last EXPORT_INTERVAL_MS of writes, not the whole session.
 *
 * Idempotent via a PID lockfile — ensureEmulatorRunning.ts spawns this unconditionally on every
 * `npm run dev`, so this script's own first job is to check whether a previous instance (from an
 * earlier, still-running dev session) is already exporting, and exit immediately if so.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXPORT_DIR = path.resolve(process.cwd(), '.emulator-data');
const LOCK_PATH = path.join(EXPORT_DIR, '.autoexport.lock');
const EXPORT_INTERVAL_MS = 5 * 60 * 1000;

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(): boolean {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      const existingPid = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
      if (existingPid && isPidAlive(existingPid)) return false;
    }
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    fs.writeFileSync(LOCK_PATH, String(process.pid));
    return true;
  } catch {
    return false; // can't reliably lock — fail closed rather than risk duplicate exporters
  }
}

function releaseLock(): void {
  try {
    if (Number(fs.readFileSync(LOCK_PATH, 'utf8').trim()) === process.pid) fs.unlinkSync(LOCK_PATH);
  } catch {
    // best-effort only
  }
}

function exportOnce(): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      'firebase',
      ['--config', 'database/firebase.json', 'emulators:export', './.emulator-data', '--force'],
      { shell: true, timeout: 60_000 },
      (error) => {
        if (error) console.error(`[auto-export] export failed: ${error.message}`);
        else console.log(`[auto-export] exported at ${new Date().toISOString()}`);
        resolve();
      },
    );
  });
}

async function main() {
  if (!acquireLock()) {
    console.log('[auto-export] another instance is already running for this emulator — exiting.');
    return;
  }
  process.on('exit', releaseLock);
  console.log(`[auto-export] started (pid ${process.pid}) — exporting every ${EXPORT_INTERVAL_MS / 60_000} min so a hard kill/reboot never loses more than that.`);

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, EXPORT_INTERVAL_MS));
    await exportOnce();
  }
}

main();

# Architecture

DressMart is physically split into workspace/concern folders — `frontend/`, `backend/`, `database/`, `mobile/`, `documentation/`, `scripts/` — instead of one flat tree. This document explains how that split is wired together, and — just as importantly — every place a file was deliberately **not** moved into its "obvious" folder because doing so would have broken a tool's own path-resolution rules.

For what lives in each folder day-to-day, see the README's "Project Structure" section. This document is about *why* the wiring looks the way it does.

## The npm workspace

The root `package.json` is an [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) manifest, not the app's own manifest:

```json
{
  "workspaces": ["frontend", "backend/functions"]
}
```

- `frontend/package.json` and `backend/functions/package.json` are the two workspace members. Each owns its own `scripts` (`dev`, `build`, `typecheck`, ...).
- **One shared `node_modules/` at the repo root.** `frontend/` has no `node_modules` of its own — npm hoists everything there and Node's module resolution walks up parent directories to find it, so `frontend/src` importing `react` resolves through the root install with zero extra configuration.
- `backend/functions/node_modules/` *does* still exist locally, by design: its `firebase-admin` version (`^12.7.0`) intentionally differs from the root's (`^14.2.0`, used by the frontend's client SDK), so npm correctly leaves that one un-hoisted rather than forcing a version conflict.
- Root scripts delegate: `"dev": "npm run dev --workspace=frontend"`, `"build": "npm run build --workspace=frontend && npm run build --workspace=backend/functions"`, etc. Running `npm run dev` from the repo root is still the one command you need.

This is what let `package.json`/`package-lock.json` genuinely move into `frontend/` (as asked) while `node_modules/` stays at the root (also asked) — those two requirements are only simultaneously satisfiable via workspaces; a single flat package.json can't do both.

## Root exceptions

Every one of these was asked to move and deliberately wasn't — each is a hard tooling constraint, not an oversight:

| File | Why it stays at the root |
|---|---|
| `package.json`, `package-lock.json` | The npm-workspaces root manifest and its lockfile — see above. Splitting further (e.g. moving these into `frontend/` with no root manifest) would mean `node_modules/` could no longer live at the root either. |
| `.env`, `.env.example` | Required to stay put by the original brief; `frontend/vite.config.ts` sets `envDir` to point back at the repo root so Vite still loads them correctly even though the config itself lives one level down. |
| `node_modules/`, `dist/` | Generated output — hoisted install and the shared web build (both the GitHub Pages workflow and `mobile/capacitor.config.ts`'s `webDir` expect `dist/` at the root). |
| `scripts/` | Shared dev tooling that seeds/validates data for the frontend and is invoked by the root `predev` hook — it isn't "frontend code" or "backend code," it's cross-cutting, so it doesn't belong nested under either. |
| `tsconfig.scripts.json` (new) | `scripts/**/*.ts` used to be covered by the old root `tsconfig.node.json`, which moved into `frontend/` along with `vite.config.ts`. Since `scripts/` didn't move with it, its typecheck coverage needed a small dedicated config left behind at the root — otherwise `npm run typecheck` would have silently stopped checking `scripts/` at all. |
| `.gitignore`, `.github/`, `.vscode/`, `.claude/` | Tool-convention locations (git, GitHub Actions, VS Code, Claude Code all look for these at the repository root specifically) — required by the original brief and by the tools themselves. |

One additional deviation from the literal brief: the root **`assets/`** folder (four PNGs: `icon.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`) was listed under "move into `frontend/`," but it's actually the source-image input for `scripts/generateCapacitorAssets.mjs` and the `@capacitor/assets` CLI — it generates Android launcher icons/splash screens, and nothing in `frontend/src` ever imports it. It moved into **`mobile/assets/`** instead, alongside the native project it actually feeds.

## Firebase CLI path wiring

`database/firebase.json` is the CLI's config, but it's invoked from different working directories depending on the command:

- **`npm run emulators`** (repo root) passes `--config database/firebase.json` explicitly. `.emulator-data/` stays relative to the root (unaffected by `--config`).
- **`scripts/ensureEmulatorRunning.ts`** (the `predev` autostart hook) does the same.
- **`backend/functions/package.json`'s own `serve`/`deploy`/`logs` scripts** run with `cwd = backend/functions/`, so they pass `--config ../../database/firebase.json` (two levels up) instead.

`.firebaserc` (project selection — `{"projects": {"default": "demo-dressmart"}}`) had to move into `database/` alongside `firebase.json` rather than stay at the root, contrary to an earlier draft of this document. The initial assumption was that Firebase CLI resolves `.firebaserc` by searching upward from the current working directory, independent of `--config` — that turned out to be wrong when actually tested: running `firebase --config database/firebase.json emulators:start` with `.firebaserc` at the repo root failed with `Error: No currently active project`, even though the repo root is an ancestor of every directory these commands run from. Copying `.firebaserc` into `database/` (alongside `firebase.json`) fixed it immediately — the CLI resolves the rc file relative to the config file's own directory, not the invoking shell's cwd. Lesson: verify CLI path-resolution behavior empirically rather than from memory before committing to a structure.

Inside `database/firebase.json` itself, paths are resolved relative to *its own* directory, not the repo root:

```json
"hosting": { "public": "../dist" },
"functions": [{ "source": "../backend/functions" }],
"firestore": { "rules": "firestore.rules" }
```

`firestore.rules`/`firestore.indexes.json`/`storage.rules` stay unqualified because they now live right next to `firebase.json` in `database/`; `hosting.public` and `functions.source` need an explicit `../` because `dist/` and `backend/functions/` don't.

## Capacitor path wiring

`mobile/capacitor.config.ts` sets `webDir: '../dist'` for the same reason — `dist/` is a sibling of `mobile/`, not a child of it. `android/` moved into `mobile/android/` alongside the config, which is Capacitor's own convention (native platform folders live next to `capacitor.config.ts`). Run Capacitor commands with `cwd = mobile/` (`cd mobile && npx cap sync`), or use the root convenience scripts `npm run cap:sync` / `npm run cap:open`, which `cd` for you.

## Vite path wiring

`frontend/vite.config.ts` uses `__dirname`-relative resolution for its `@` alias (`path.resolve(__dirname, './src')`), so that needed **no change** — it automatically points at `frontend/src` once the whole file moved down a level. Three things did need explicit settings, because they're not automatically relative to the config file:

- `envDir: path.resolve(__dirname, '..')` — load `.env` from the repo root (see "Root exceptions" above).
- `build.outDir: path.resolve(__dirname, '../dist')` + `emptyOutDir: true` — write the production build to the repo root's `dist/`, not `frontend/dist/`. `emptyOutDir` is required explicitly because Vite refuses to guess it's safe to wipe a directory outside its own root.
- The import of the dev-only reseed plugin changed from `./scripts/vite/devSeedPlugin.js` to `../scripts/vite/devSeedPlugin.js`, since `scripts/` stayed at the root while `vite.config.ts` moved down one level.

## TypeScript project wiring

- `frontend/tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` moved as a set — their relative references to each other, and `tsconfig.app.json`'s `"@/*": ["./src/*"]` path mapping, needed no changes since `src/` moved right alongside them.
- `frontend/tsconfig.node.json`'s `include` dropped `"scripts/**/*.ts"` (it used to cover both `vite.config.ts` and the root `scripts/` in one config, back when both lived at the repo root) — now it only covers `vite.config.ts`, which is genuinely local to `frontend/`.
- The new root `tsconfig.scripts.json` picks up exactly the coverage that dropped: `scripts/**/*.ts`, checked without a `paths` mapping since nothing in `scripts/` uses the `@/` alias (verified before writing this config).

## Manual steps still required

Everything below was fixed programmatically as part of this restructure and verified (`npm install`, `npm run typecheck`, `npm run build`, `npm run emulators`, `npm run dev`, `cd mobile && npx cap sync`, `cd mobile/android && ./gradlew assembleDebug` all pass). Nothing here is a loose end from the move itself — these are pre-existing, environment-specific steps unrelated to the restructure:

- If you have local shell aliases, IDE run configurations, or muscle-memory commands referencing the old paths (`npm --prefix functions ...`, `cd android`, editing `firebase.json` at the root, etc.), update them to the new locations above.
- `backend/functions/.env` (the Razorpay key config, gitignored) needs recreating at its new path if you had one under the old `functions/.env` — copy `backend/functions/.env.example` again.
- Any CI/CD configuration outside this repo (e.g. a hosting provider's dashboard-configured build command, not the checked-in GitHub Actions workflow) that hardcodes `npx cap sync android` or `firebase deploy` without a `--config`/cwd change needs the same path updates described above. The checked-in `.github/workflows/deploy-pages.yml` needed **no changes** — it only calls `npm ci` and `npm run build`, both of which still work unmodified from the repo root.

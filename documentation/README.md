# DressMart

A lightweight, multi-vendor marketplace for **Men's** and **Kids' Wear** — built with React 19, TypeScript, Tailwind CSS, and **Firebase** end to end (Auth, Firestore, Storage, Cloud Functions, Cloud Messaging, Hosting), with **Razorpay** for payments.

![DressMart](https://img.shields.io/badge/status-Buyer%20%2B%20Seller%20%2B%20Head%20Seller-orange)

---

## Roles

There are exactly three roles — no separate admin app.

| Role | What they do |
|---|---|
| **Buyer** | Browse/search/filter products, wishlist, cart, checkout (Razorpay or COD), track orders, cancel/return/exchange eligible items, coupons, addresses, profile, notifications. |
| **Seller** | Manage their own products, inventory, orders, returns, and exchanges. Can never see another seller's data. Multiple sellers are supported. |
| **Head Seller** | A single, designated Seller account with everything a Seller has, **plus**: approve/suspend seller accounts, platform analytics, revenue reports, coupon management, and platform settings. Uses the exact same Seller Dashboard — extra menu items simply appear when `role === 'head_seller'`. |

A buyer becomes a seller by applying at `/sell` (`SellerApplyPage`); their account sits in `seller_status: 'pending'` until the Head Seller approves it from `/seller/sellers`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS (custom DressMart theme, dark mode) |
| Routing | React Router 7 |
| Data fetching | TanStack Query |
| Forms & validation | React Hook Form + Zod |
| Animation | Framer Motion |
| Icons | Lucide React |
| Backend | Firebase — Authentication, Firestore, Storage, Cloud Functions, Cloud Messaging, Hosting |
| Payments | Razorpay (UPI, cards, net banking, wallets, EMI) + Cash on Delivery |

---

## Quick Start

```bash
npm install
npm run dev
```

By default (`VITE_USE_FIREBASE_EMULATOR=true` in `.env`, or simply no real Firebase project configured) the app talks to the **local Firebase Emulator Suite** instead of a live project — nothing to sign up for just to click around.

### Running against the emulators

1. Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`, then `firebase login`.
2. **Required, one-time:** `cp backend/functions/.env.example backend/functions/.env` (git-ignored, so this doesn't happen automatically). Without it, `defineString('RAZORPAY_KEY_ID')` has no value anywhere and the Firebase CLI tries to interactively prompt for one at Functions-emulator startup — which hangs forever in any non-interactive terminal, silently blocking **every** callable (`placeCodOrder`, `verifyAndPlaceOrder`, `cancelOrder`, everything), not just Razorpay-dependent ones. The emulator log's tell: `? Enter a string value for RAZORPAY_KEY_ID:` with no further output. If Buy Now/checkout/order placement all silently fail, check for exactly that line first.
3. In one terminal: `npm run emulators` (starts Auth on 9099, Firestore on 8081, Storage on 9199, Functions on 5001, and the Emulator UI at `http://localhost:4000`, using `database/firebase.json`; data is imported/exported from `.emulator-data/` at the repo root on start/stop, so a graceful restart doesn't wipe your seeded catalog — a forceful kill, e.g. the machine/container restarting, will). Confirm it printed `functions: Loaded environment variables from .env.` — if it's sitting at the prompt above instead, see step 2. You normally don't need this step at all — `npm run dev`'s `predev` hook (`scripts/ensureEmulatorRunning.ts`) starts the emulator for you automatically if it isn't already running.
4. `npm run dev`. You don't need to seed anything by hand — `predev` automatically checks whether `products` is empty and, if so, seeds the full catalog for you (see "Reliability" below). This is what makes the app recover on its own after an emulator restart wipes its data.

### Connecting a real Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com), then add a **Web app** to it.
2. Enable **Authentication** providers: Email/Password, Google, Phone.
3. Copy `.env.example` to `.env` (repo root) and fill in the `VITE_FIREBASE_*` values from Project Settings, plus `VITE_FIREBASE_VAPID_KEY` (Project Settings → Cloud Messaging → Web Push certificates) and `VITE_RAZORPAY_KEY_ID`. Set `VITE_USE_FIREBASE_EMULATOR=false` (or just remove the line — `false`/absent behave identically).
4. Link the CLI to your project: `firebase --config database/firebase.json use --add`.
5. Deploy security rules and indexes: `firebase --config database/firebase.json deploy --only firestore:rules,firestore:indexes,storage`.
6. Set the Razorpay Cloud Functions config (see `backend/functions/README.md`), then deploy: `firebase --config database/firebase.json deploy --only functions`.
7. Seed the real Firestore database — download a service account key (Project Settings → Service Accounts → Generate new private key), then:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run seed
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run seed:curated-formal-shirts
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run seed:curated-shirts-tshirts
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run seed:curated-apparel
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run seed:curated-kids
   ```
   This writes the full ~962-product catalog (the same one you get for free against the local emulator). Every script upserts by a deterministic ID, so re-running any of them is always safe — it can never create duplicates, and only ever fills in missing products or refreshes existing ones.
8. Deploy the frontend to Firebase Hosting: `npm run build && firebase --config database/firebase.json deploy --only hosting`. **Deploying to Vercel instead?** See "Deploying the frontend to Vercel" below — skip this step.
9. Manually promote your own account's `role` to `'head_seller'` in the Firestore console the first time — there's exactly one Head Seller, and it's bootstrapped by hand, not through the UI.

### Deploying the frontend to Vercel

Firebase Cloud Functions **cannot run on Vercel** — Vercel hosts static sites and its own serverless functions, not Firebase's. Deploying to Vercel replaces *only* step 8 above (Firebase Hosting) with a different static host; steps 1–7 and 9 (the real Firebase project, Firestore rules, Cloud Functions deploy, seeding, Head Seller) still all happen against Firebase exactly as described, regardless of where the frontend itself is hosted.

1. Import the GitHub repo into Vercel. `vercel.json` at the repo root already sets `buildCommand: "npm run build"`, `outputDirectory: "dist"`, and a catch-all SPA rewrite to `index.html` (React Router needs that rewrite, or refreshing any non-root route 404s) — leave Vercel's own **Root Directory** project setting at the repo root (not `frontend/`), since the build command runs `npm run build` from there and only descends into `frontend/` via the npm workspace.
2. In the Vercel project's **Settings → Environment Variables**, set every one of these (Production, and Preview if you want preview deployments to work too) from the real Firebase project you configured above — the exact same values that went into your local `.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_VAPID_KEY`
   - `VITE_RAZORPAY_KEY_ID`
   - `VITE_SITE_URL` — set to your actual Vercel URL (e.g. `https://your-app.vercel.app`), used in password-reset email links.

   **Do not set `VITE_USE_FIREBASE_EMULATOR` at all** (or set it to `false`) — if it's ever accidentally set to `true` on Vercel, the deployed site will try to reach a local emulator that doesn't exist from a visitor's browser, which is exactly the bug this section exists to prevent. As of this codebase, a production build (which `npm run build` always is) ignores real-vs-placeholder credential detection entirely and simply refuses to fall back to the emulator — so the actual risk here is narrower than it used to be, but the env var is still meaningless to set in a deployed environment either way.
3. **Firebase Auth won't work on your Vercel domain until you authorize it**: Firebase Console → Authentication → Settings → **Authorized domains** → add your Vercel domain (both the stable production domain, e.g. `your-app.vercel.app`, and any custom domain you attach). Every Vercel *preview* deployment gets its own random subdomain — those won't be authorized and Google/phone sign-in will fail there by design; test auth flows against the stable production domain.
4. Redeploy (push to the branch Vercel watches, or trigger a redeploy from the dashboard) after setting the env vars — Vercel only picks up new environment variables on the *next* build, not retroactively for a build that already ran.
5. If you skipped Firebase Hosting (step 8 above) entirely, note that `database/firebase.json`'s `hosting` block simply goes unused — that's fine, it costs nothing to leave configured for later.

---

## Data Model (Firestore)

| Collection | Notes |
|---|---|
| `users` | One profile doc per auth user (`role: buyer\|seller\|head_seller`, plus seller-only fields: `store_name`, `gst_number`, `seller_status`, `fcm_tokens`). |
| `products` | One doc per listing, owned by exactly one `seller_id`. Stock is **not** stored here. |
| `inventory` | One doc per product (same id as its product), `variant_stock` keyed by variant id — separated from `products` so high-frequency stock writes never touch the larger, rarely-changing product doc. Product pages merge the two on read; stock updates push live via `onSnapshot`. |
| `orders` | One doc **per seller per checkout** — a cart spanning multiple sellers splits into multiple `Order` docs sharing the same `group_id`/`order_number`, which is what makes "a seller only sees their own orders" a plain `where seller_id == uid` query. |
| `returns` / `exchanges` | Buyer-created requests, seller/Head-Seller-advanced status. |
| `cart` / `wishlist` / `addresses` / `notifications` / `coupons` / `reviews` / `seller_requests` | As named. Guest cart/wishlist live in `localStorage` and merge into Firestore on login. |
| `platform_settings/config` | Singleton doc — Head Seller's Platform Settings page (shipping charge, return/exchange windows, policy text, etc.). |

Security is enforced by `database/firestore.rules` and `database/storage.rules` — read those for the exact ownership model (buyer-owns-their-own-data, seller-owns-their-own-products/orders, Head-Seller-can-see-everything).

---

## Cloud Functions

Under `backend/functions/` (separate TypeScript project, its own `package.json`/lockfile-managed dependencies, deployed independently — see `backend/functions/README.md` for local dev, config/secrets, and the full callable/trigger list). In short:

- **Callables**: `createRazorpayOrder`, `placeCodOrder`, `verifyAndPlaceOrder`, `cancelOrder`, `reviewSellerRequest`, `suspendSellerAccount` — anything that needs server-trusted pricing/stock, an external API call, or an atomic multi-document write.
- **Firestore triggers**: fire notifications (and push them via FCM) whenever an order/return/exchange status changes, a seller applies, or a notification doc is created — plain seller status-advance writes from the client are enough to drive the whole notification pipeline.

---

## Reliability

- **Emulator autostart + auto-seed on empty catalog (dev only)** — `npm run dev`'s `predev` hook runs `scripts/ensureEmulatorRunning.ts` (starts the Firestore emulator automatically if it isn't already up — no more running `npm run emulators` in a second terminal) then `scripts/ensureSeeded.ts` (checks whether `products` has any docs and, if not, re-runs the full seed pipeline — no manual `npm run seed` needed). The check-and-seed logic itself lives in the reusable `scripts/lib/ensureSeededCore.ts`, shared with a second caller: `scripts/vite/devSeedPlugin.ts` exposes the same logic as a dev-only Vite endpoint (`/__dev/ensure-seeded`, `apply: 'serve'` so it's absent from `vite build`) that `useCatalogHealth` calls automatically if it ever finds the catalog empty mid-session (e.g. the emulator got restarted while the browser tab was still open) — the app self-heals without a manual reseed step. All of this only ever targets the local emulator and fails soft if it isn't reachable in time. It deliberately does **not** run against a real project or as part of `npm run build`/`preview` — an empty catalog on a live marketplace just means no seller has listed anything yet, which is a legitimate state the UI should show honestly (see `CatalogHealthGate` below), not paper over with fake demo products.
- **`CatalogHealthGate`** (`frontend/src/components/common/CatalogHealthGate.tsx`, wraps the router in `App.tsx`) — a one-time, app-boot check (not a per-page concern) that distinguishes "genuinely offline/unreachable" from "connected but empty", showing a `Preparing product catalog...` state, a distinct empty-catalog message, or an offline message — each with a Retry button — instead of every page silently rendering blank grids.
- **Offline persistence** — Firestore is initialized with `persistentLocalCache`/`persistentMultipleTabManager` (`frontend/src/lib/firebase.ts`), so previously-loaded products/cart/orders stay browsable offline and queued writes sync automatically once connectivity returns.
- **Realtime everywhere it matters** — Products, Inventory, Cart, Orders, Returns, and Exchanges all use Firestore `onSnapshot` listeners (see `subscribeTo*`/`subscribeFor*` in the respective `services/*.ts`), not polling or manual refresh. A seller updating stock, price, or an order/return/exchange status is reflected on the buyer's screen live.
- **Friendly error messages** — `frontend/src/lib/firebaseErrors.ts` maps common Firebase error codes (auth failures, `permission-denied`, `unavailable`, offline) to plain-language messages instead of raw SDK output. Wired into auth pages, checkout/payment, the seller dashboard's product/order/return/exchange/coupon/category/banner/settings mutations, and image-upload flows (avatar, shop logo/banner). Cloud Function callable errors are treated specially — a callable's own thrown message (e.g. `Insufficient stock for "Red Shirt, size M".`) is shown as-is rather than replaced by the generic per-code text, since Cloud Function authors write those messages specifically for end users.
- **Offline mode** — two layers: `CatalogHealthGate` (above) is a one-time boot check; `OfflineBanner` (`frontend/src/components/common/OfflineBanner.tsx`, mounted app-wide in `App.tsx`) is a live, non-blocking "No Internet Connection" strip with a Retry button that appears/disappears as `navigator.onLine` changes mid-session, and auto-refetches every active query on reconnect. Cached pages/products stay fully browsable underneath it either way (Firestore's own offline persistence, see above).

---

## Project Structure

Physically split into workspace/concern folders — see `ARCHITECTURE.md` for the full rationale, the npm-workspaces wiring, and every justified exception to "everything lives in its folder."

### `frontend/` — React + TypeScript + Tailwind (npm workspace member)

```
frontend/
  package.json, vite.config.ts, tsconfig.json, tsconfig.app.json, tsconfig.node.json
  tailwind.config.js, postcss.config.js, eslint.config.js, index.html
  public/
  src/
    components/       ui/, layout/, product/, cart/, orders/, profile/, wishlist/, common/
    pages/
      home/ men/ kids/ category/ product/    storefront browsing
      cart/ checkout/ orders/                cart → checkout → Razorpay/COD → tracking
      wishlist/ profile/ auth/ static/ errors/
      seller/                                Seller Dashboard + Head-Seller-only pages
    layouts/          MainLayout, AuthLayout, AccountLayout, SellerLayout
    routes/           AppRoutes, ProtectedRoute, RequireSeller, RequireHeadSeller
    services/         one file per domain — all Firestore/Firebase now, no mock layer
    hooks/            TanStack Query hooks wrapping the services
    lib/              firebase.ts (SDK init), env.ts, roles.ts, queryClient.ts, utils
    types/            database.ts (Firestore doc shapes), seller.ts
    contexts/         AuthContext (Firebase Auth + realtime profile), ThemeContext
```

### `backend/functions/` — Firebase Cloud Functions (npm workspace member, own dependencies)

```
backend/functions/
  src/            callables + Firestore triggers — see "Cloud Functions" above for the full list
  index.ts, package.json, tsconfig.json, README.md     separate TypeScript project, deployed independently
```

Used for: Razorpay order creation/verification, order placement/cancellation, seller approval/suspension, and the notification-trigger pipeline.

### `database/` — Firebase project configuration

```
database/
  firebase.json          hosting/firestore/storage/functions/emulators config
  .firebaserc            project selection — must stay colocated with firebase.json, see ARCHITECTURE.md
  firestore.rules  firestore.indexes.json  storage.rules
```

### `mobile/` — Capacitor Android shell

```
mobile/
  capacitor.config.ts   webDir: '../dist' — wraps the same web build; no separate mobile codebase to maintain
  android/              app/, gradle/, AndroidManifest.xml (via app/src/main/) — see "Android / Play Store" below
  assets/               icon.png, icon-foreground.png, icon-background.png, splash.png — @capacitor/assets source images
```

### `scripts/` — shared dev tooling (deliberately stays at the repo root)

```
scripts/
  seedFirestore.ts, seedCurated*.ts, generateImageManifest.ts, ensureEmulatorRunning.ts, ensureSeeded.ts, validate*.ts
  lib/ensureSeededCore.ts, vite/devSeedPlugin.ts
```

Not nested under `frontend/` or `backend/` because it seeds/validates data for both and drives the root-level `predev` hook — see "Reliability" above and `ARCHITECTURE.md`.

### `documentation/`

```
documentation/
  README.md         this file
  ARCHITECTURE.md    workspace layout, root exceptions, manual steps
```

`backend/functions/README.md` stays colocated with the functions codebase it documents rather than moving here.

### Stays at the repo root

`.env`/`.env.example`, `.gitignore`, `.github/`, `.vscode/`, `.claude/`, `node_modules/`, `dist/`, `package.json`/`package-lock.json` (the npm-workspaces root manifest), and `tsconfig.scripts.json` (typechecks `scripts/`). Each is a **required** exception, not a leftover — `ARCHITECTURE.md` explains the tooling constraint behind every one.

---

## Android / Play Store release readiness

- **Signing**: `mobile/android/app/build.gradle` reads `mobile/android/keystore.properties` (gitignored, along with the `.jks` it points at) to sign release builds. A local upload keystore already exists at `mobile/android/app/dressmart-upload-key.jks` — **back it up securely** (e.g. a password manager or encrypted storage) along with `keystore.properties`; losing both means you can never update this app under the same Play Store listing again. Enroll in [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756) so Google holds the actual app signing key and this becomes just your upload key. Once backed up, run `cd mobile/android && ./gradlew bundleRelease` to produce a signed `.aab`.
- **Push notifications are scaffolded but inert** — `@capacitor/push-notifications` is installed and wired (`frontend/src/lib/pushNotifications.ts`, called from `initCapacitorNative`): it creates a default Android notification channel, requests permission, and registers for a token, with listeners for registration/receipt/tap already in place. `POST_NOTIFICATIONS` is declared in `AndroidManifest.xml`. None of it can actually reach a real device yet because there's no `google-services.json` — without it, the native FCM SDK has no project to register against, so registration fails safely (logged, not thrown) rather than crashing. See "Push Notification Setup (future)" below for the remaining steps once a real project exists.
- **Deep linking**: a custom `dressmart://` scheme is wired (manifest intent-filter in `AndroidManifest.xml`, resolved via `frontend/src/lib/deepLinks.ts` and bridged into React Router by `useDeepLinkNavigation` in `AppRoutes.tsx`) — supports `dressmart://product/{slug}`, `dressmart://orders/{id}`, `dressmart://men[/{slug}]`, `dressmart://kids[/{slug}]`, `dressmart://cart`, `dressmart://wishlist`. Android App Links (`https://` + a verified domain) can be added later once a real production domain exists — that's additive, not a replacement.
- **Google Sign-In** (`authService.ts`'s `signInWithGoogle`) uses `signInWithPopup`, a browser-popup flow — this should be functionally tested on a real Android device/emulator inside the Capacitor WebView, since OAuth popups can behave differently there than in a normal browser tab. If it's unreliable, the fix is a native Google Sign-In plugin, not a code change to this doc's scope.
- **Version bump**: `versionCode`/`versionName` in `mobile/android/app/build.gradle` are still Capacitor's defaults (`1` / `"1.0"`) — fine for a first upload, remember to increment `versionCode` on every subsequent release.

### Environment Variables

All in `.env` (repo root — copy from `.env.example`, gitignored). Nothing Firebase-related is hardcoded in source — `frontend/src/lib/firebase.ts` throws a clear startup error if `VITE_USE_FIREBASE_EMULATOR` isn't `'true'` and real credentials are still missing, rather than silently falling back to a demo project. `frontend/vite.config.ts` sets `envDir` to point back at the repo root so this still loads correctly even though `vite.config.ts` itself now lives in `frontend/`.

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Firebase Web app config — Project Settings → General → "Your apps". |
| `VITE_FIREBASE_VAPID_KEY` | Web Push certificate key, for browser/PWA push — Project Settings → Cloud Messaging. |
| `VITE_RAZORPAY_KEY_ID` | Razorpay publishable Key ID (safe for the client). The Key **Secret** lives only in Cloud Functions config (`backend/functions/README.md`), never in this file. |
| `VITE_USE_FIREBASE_EMULATOR` | `true` to force the local emulator suite even if real credentials are present; otherwise defaults to emulator mode only when credentials are missing/placeholder. |
| `VITE_SITE_URL` | Base URL used in password-reset email redirect links. |

### Android Build Instructions

```bash
npm run build          # type-check + production web build → dist/ (repo root)
cd mobile && npx cap sync    # copy dist/ + plugin config into the native project (or: npm run cap:sync from root)
cd android
./gradlew assembleDebug   # unsigned debug APK — for local device/emulator testing
./gradlew bundleRelease   # signed release .aab — requires keystore.properties, see Signing above
```

Run on a connected device/emulator directly with `cd mobile && npx cap run android`, or open `mobile/android/` in Android Studio for a full IDE (`npm run cap:open` from the repo root).

### Play Store Release Process

1. Confirm `versionCode` was bumped from the last upload (`mobile/android/app/build.gradle`).
2. `npm run build && cd mobile && npx cap sync && cd android && ./gradlew bundleRelease`.
3. Upload `mobile/android/app/build/outputs/bundle/release/app-release.aab` to Play Console → your app → Production (or a testing track first).
4. First-ever upload only: enroll in [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756) when prompted — Google then re-signs the app for distribution using its own key, and `dressmart-upload-key.jks` becomes just your upload key, not the final signing key.
5. Fill in the Play Console listing (screenshots, description, privacy policy URL, data-safety form) — outside this repo's scope.

### Production Checklist

- [ ] Real Firebase project created; `.env` filled in with real `VITE_FIREBASE_*` values; `VITE_USE_FIREBASE_EMULATOR=false`.
- [ ] `firebase --config database/firebase.json deploy --only firestore:rules,firestore:indexes,storage` run against the real project.
- [ ] Razorpay Cloud Functions config set (live keys, not test keys) — see `backend/functions/README.md`.
- [ ] Real Firestore seeded (`npm run seed` + all four `seed:curated-*` scripts with `GOOGLE_APPLICATION_CREDENTIALS` set — see "Connecting a real Firebase project" above).
- [ ] If deploying to Vercel (or any host other than Firebase Hosting): every `VITE_FIREBASE_*`/`VITE_RAZORPAY_KEY_ID`/`VITE_SITE_URL` var set on the host itself — see "Deploying the frontend to Vercel" above.
- [ ] Deployed domain added to Firebase Console → Authentication → Settings → Authorized domains, or Google/phone sign-in will fail there even with everything else correct.
- [ ] Exactly one Head Seller account promoted by hand in the Firestore console.
- [ ] `versionCode`/`versionName` bumped for this release.
- [ ] `mobile/android/app/dressmart-upload-key.jks` + `mobile/android/keystore.properties` backed up securely outside this repo.
- [ ] `./gradlew bundleRelease` produces a signed `.aab` (verify with `jarsigner -verify`).
- [ ] Physical-device testing checklist below completed at least once.
- [ ] `google-services.json` added and push notifications tested end-to-end, if launching with push enabled (otherwise: ship without it, add later — see below).

### Push Notification Setup (future)

Everything client-side is already scaffolded and inert (see above). To turn it on:

1. In the real Firebase project's console, add an **Android app** with package name `com.dressmart.app`, download `google-services.json`, and place it at `mobile/android/app/google-services.json`. `mobile/android/app/build.gradle` already conditionally applies the `google-services` Gradle plugin only when this file exists — no Gradle changes needed.
2. Add a dedicated small monochrome notification icon (Android design guideline: transparent + white silhouette only) — without one, Android falls back to the app's full-color launcher icon, which renders poorly in the status bar on some OEM skins.
3. Rebuild (`cd mobile && npx cap sync`) — `frontend/src/lib/pushNotifications.ts`'s `initPushNotifications()` will start actually registering devices and receiving tokens with no further code changes.
4. Persist each device's token (from the `'registration'` listener) to that user's `users/{uid}` Firestore doc — there's a `TODO(production)` comment marking exactly where in `pushNotifications.ts`.
5. Add a Cloud Function (`backend/functions/src`) that reads those tokens and calls `admin.messaging().send(...)` when an order/return/exchange status changes, reusing the existing Firestore-trigger notification pipeline described above.
6. Test on a physical device — the Android emulator's Google Play Services support for FCM can be unreliable depending on the system image.

### Physical Device Testing Checklist

The Android emulator in a sandboxed/CI environment can hit host-level GPU rendering issues (SwiftShader software rendering under resource pressure) that look like app bugs but aren't — real hardware is the actual verification of record for the items below:

- [ ] Splash screen shows the branded image (not a flash of white) and transitions cleanly to the app.
- [ ] Status bar color/style matches the app's navy theme.
- [ ] Safe-area insets (notch/gesture-nav) — bottom nav, sticky Add-to-Cart/Buy Now bar, and sticky checkout bar don't overlap system gesture areas.
- [ ] Hardware Back button: closes open drawers/modals first, then navigates back through app history, then exits at the root.
- [ ] Keyboard: focusing the search bar or any form input doesn't hide the field behind the on-screen keyboard.
- [ ] Pull-to-refresh on Home actually refetches (not just a visual spinner).
- [ ] Deep link: `adb shell am start -a android.intent.action.VIEW -d "dressmart://product/<a-real-product-slug>"` opens directly to that product's PDP from a cold start.
- [ ] Google Sign-In popup flow completes successfully inside the WebView (flagged above as the one auth method most likely to need a native plugin instead).
- [ ] Airplane mode mid-session: `OfflineBanner` appears, cached pages stay browsable, banner disappears and queries refetch automatically on reconnect.
- [ ] Razorpay checkout (UPI/card/wallet/netbanking, whichever your test merchant account has enabled) and COD both complete an order successfully.

## Known limitations / next steps

- **Search** is a client-side substring filter over a bounded fetch of active products — fine at this scale, but a dedicated search service (Algolia/Typesense) would be the next step for a larger catalog.
- **Order pricing is server-recomputed** for the actual charge (`placeCodOrder`/`verifyAndPlaceOrder` read live product/inventory docs), but the Checkout page's on-screen estimate is still client-computed for responsiveness — they should agree, but the server total is always the source of truth.
- **`product.rating`/`rating_count`** are plain fields, not yet kept in sync with the `reviews` collection via a Cloud Function trigger — reviews are computed live instead; fine for correctness, a bit more reads than a denormalized counter.
- **One Head Seller, bootstrapped manually** — there's no UI to create the first Head Seller account; promote it by hand in Firestore after your first sign-up.
- **A handful of `toast.error(...)` call sites may still show raw text** — the sweep covered auth, checkout/payment, the seller dashboard, and image uploads (the highest-traffic flows); any newly-added mutation should route its error through `getFriendlyErrorMessage` (`frontend/src/lib/firebaseErrors.ts`) rather than `error.message` directly.
- **Performance**: no virtualized lists or list-level code-splitting beyond route-level lazy loading yet — fine at this catalog's scale (hundreds of products), worth revisiting as a dedicated pass if the catalog grows substantially.
- **No automated dead-code sweep** has been run — "remove unused code" is safest as its own reviewed pass (with a real usage-analysis tool) rather than a speculative delete alongside unrelated changes.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |
| `npm run seed` | Seed Firestore (emulator or real project) with a generated catalog |
| `npm run seed:curated-formal-shirts` | Seed/update the hand-verified Formal Shirt products from `frontend/src/lib/productImages.ts`'s `REAL_PRODUCT_PHOTOGRAPHY` map — additive/idempotent, never touches the rest of the catalog (see `scripts/seedCuratedFormalShirts.ts`'s own docstring for the pattern to follow when curating another category/batch this way) |
| `npx tsx scripts/migrateFormalShirtVariants.ts` | One-off repair for a color/photo data-integrity bug in generically-seeded Formal Shirts (a product's declared color didn't always match what its verified photo actually showed) — safe to re-run any time, a no-op once everything's already correct. Preserves product ids/URLs/reviews/orders; only relabels color/color_hex/sku/tags/image color tags to match the verified truth. Prints a full before/after + flagged-for-review report. |
| `npm run emulators` | Start the local Firebase Emulator Suite (with data persistence) — usually unnecessary, `npm run dev` starts it automatically |
| `npm run cap:sync` | Build the frontend and sync it into the Capacitor Android project (`mobile/`) |
| `npm run cap:open` | Open the Android project (`mobile/android/`) in Android Studio |

`scripts/ensureSeeded.ts` and `scripts/ensureEmulatorRunning.ts` aren't run directly — they're wired into `predev` and handle emulator autostart + auto-seeding only when needed (see "Reliability" above).

---

## Design System

- **Primary** `#131921` · **Accent** `#FF9900` · **Background** `#F8F8F8` · **Cards** white, rounded-2xl, soft shadows.
- Font: **Poppins**.
- Full dark mode via Tailwind's `class` strategy, toggle in the header.
- Responsive: mobile-first, with dedicated mobile nav drawer and filter drawer.

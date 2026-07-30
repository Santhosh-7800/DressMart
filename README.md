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
2. **Required, one-time:** `cp functions/.env.example functions/.env` (git-ignored, so this doesn't happen automatically). Without it, `defineString('RAZORPAY_KEY_ID')` has no value anywhere and the Firebase CLI tries to interactively prompt for one at Functions-emulator startup — which hangs forever in any non-interactive terminal, silently blocking **every** callable (`placeCodOrder`, `verifyAndPlaceOrder`, `cancelOrder`, everything), not just Razorpay-dependent ones. The emulator log's tell: `? Enter a string value for RAZORPAY_KEY_ID:` with no further output. If Buy Now/checkout/order placement all silently fail, check for exactly that line first.
3. In one terminal: `npm run emulators` (starts Auth on 9099, Firestore on 8081, Storage on 9199, Functions on 5001, and the Emulator UI at `http://localhost:4000`; data is imported/exported from `.emulator-data/` on start/stop, so a graceful restart doesn't wipe your seeded catalog — a forceful kill, e.g. the machine/container restarting, will). Confirm it printed `functions: Loaded environment variables from .env.` — if it's sitting at the prompt above instead, see step 2.
4. In another terminal: `npm run dev`. You don't need to seed anything by hand — `predev` automatically checks whether `products` is empty and, if so, seeds the full catalog for you (see "Reliability" below). This is what makes the app recover on its own after an emulator restart wipes its data.

### Connecting a real Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com), then add a **Web app** to it.
2. Enable **Authentication** providers: Email/Password, Google, Phone.
3. Copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_*` values from Project Settings, plus `VITE_FIREBASE_VAPID_KEY` (Project Settings → Cloud Messaging → Web Push certificates) and `VITE_RAZORPAY_KEY_ID`. Set `VITE_USE_FIREBASE_EMULATOR=false`.
4. Link the CLI to your project: `firebase use --add`.
5. Deploy security rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes,storage`.
6. Set the Razorpay Cloud Functions config (see `functions/README.md`), then deploy: `firebase deploy --only functions`.
7. Deploy the frontend: `npm run build && firebase deploy --only hosting`.
8. Manually promote your own account's `role` to `'head_seller'` in the Firestore console the first time — there's exactly one Head Seller, and it's bootstrapped by hand, not through the UI.

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

Security is enforced by `firestore.rules` and `storage.rules` at the repo root — read those for the exact ownership model (buyer-owns-their-own-data, seller-owns-their-own-products/orders, Head-Seller-can-see-everything).

---

## Cloud Functions

Under `functions/` (separate TypeScript project, deployed independently — see `functions/README.md` for local dev, config/secrets, and the full callable/trigger list). In short:

- **Callables**: `createRazorpayOrder`, `placeCodOrder`, `verifyAndPlaceOrder`, `cancelOrder`, `reviewSellerRequest`, `suspendSellerAccount` — anything that needs server-trusted pricing/stock, an external API call, or an atomic multi-document write.
- **Firestore triggers**: fire notifications (and push them via FCM) whenever an order/return/exchange status changes, a seller applies, or a notification doc is created — plain seller status-advance writes from the client are enough to drive the whole notification pipeline.

---

## Reliability

- **Auto-seed on empty catalog (dev only)** — `scripts/ensureSeeded.ts` runs automatically before `npm run dev` (`predev`). It checks whether `products` has any docs; if not (e.g. the emulator restarted and lost its in-memory data before exporting), it re-runs the full seed pipeline automatically — no manual `npm run seed` needed. It only ever targets the local emulator and fails soft (a warning, not a crash) if the emulator isn't reachable yet. It deliberately does **not** run against a real project or as part of `npm run build`/`preview` — an empty catalog on a live marketplace just means no seller has listed anything yet, which is a legitimate state the UI should show honestly (see `CatalogHealthGate` below), not paper over with fake demo products.
- **`CatalogHealthGate`** (`src/components/common/CatalogHealthGate.tsx`, wraps the router in `App.tsx`) — a one-time, app-boot check (not a per-page concern) that distinguishes "genuinely offline/unreachable" from "connected but empty", showing a `Preparing product catalog...` state, a distinct empty-catalog message (with a dev-mode hint pointing at `npm run emulators`), or an offline message — each with a Retry button — instead of every page silently rendering blank grids.
- **Offline persistence** — Firestore is initialized with `persistentLocalCache`/`persistentMultipleTabManager` (`src/lib/firebase.ts`), so previously-loaded products/cart/orders stay browsable offline and queued writes sync automatically once connectivity returns.
- **Realtime everywhere it matters** — Products, Inventory, Cart, Orders, Returns, and Exchanges all use Firestore `onSnapshot` listeners (see `subscribeTo*`/`subscribeFor*` in the respective `services/*.ts`), not polling or manual refresh. A seller updating stock, price, or an order/return/exchange status is reflected on the buyer's screen live.
- **Friendly error messages** — `src/lib/firebaseErrors.ts` maps common Firebase error codes (auth failures, `permission-denied`, `unavailable`, offline) to plain-language messages instead of raw SDK output. Wired into auth pages, checkout/payment, the seller dashboard's product/order/return/exchange/coupon/category/banner/settings mutations, and image-upload flows (avatar, shop logo/banner). Cloud Function callable errors (`functions/*` codes) are treated specially — a callable's own thrown message (e.g. `Insufficient stock for "Red Shirt, size M".`) is shown as-is rather than replaced by the generic per-code text, since Cloud Function authors write those messages specifically for end users.
- **Offline mode** — two layers: `CatalogHealthGate` (below) is a one-time boot check; `OfflineBanner` (`src/components/common/OfflineBanner.tsx`, mounted app-wide in `App.tsx`) is a live, non-blocking "No Internet Connection" strip with a Retry button that appears/disappears as `navigator.onLine` changes mid-session, and auto-refetches every active query on reconnect. Cached pages/products stay fully browsable underneath it either way (Firestore's own offline persistence, see below).

---

## Project Structure

```
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

functions/          Firebase Cloud Functions (Razorpay, order placement, notifications)
scripts/
  seedFirestore.ts  seeds brands/categories/products/inventory into Firestore
  generateImageManifest.ts

firestore.rules / firestore.indexes.json / storage.rules / firebase.json
```

---

## Android / Play Store release readiness

- **Signing**: `android/app/build.gradle` reads `android/keystore.properties` (gitignored, along with the `.jks` it points at) to sign release builds. A local upload keystore already exists at `android/app/dressmart-upload-key.jks` — **back it up securely** (e.g. a password manager or encrypted storage) along with `keystore.properties`; losing both means you can never update this app under the same Play Store listing again. Enroll in [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756) so Google holds the actual app signing key and this becomes just your upload key. Once backed up, run `cd android && ./gradlew bundleRelease` to produce a signed `.aab`.
- **Push notifications are scaffolded but inert** — `@capacitor/push-notifications` is installed and wired (`src/lib/pushNotifications.ts`, called from `initCapacitorNative`): it creates a default Android notification channel, requests permission, and registers for a token, with listeners for registration/receipt/tap already in place. `POST_NOTIFICATIONS` is declared in `AndroidManifest.xml`. None of it can actually reach a real device yet because there's no `google-services.json` — without it, the native FCM SDK has no project to register against, so registration fails safely (logged, not thrown) rather than crashing. See "Push Notification Setup (future)" below for the remaining steps once a real project exists.
- **Deep linking**: a custom `dressmart://` scheme is wired (manifest intent-filter in `AndroidManifest.xml`, resolved via `src/lib/deepLinks.ts` and bridged into React Router by `useDeepLinkNavigation` in `AppRoutes.tsx`) — supports `dressmart://product/{slug}`, `dressmart://orders/{id}`, `dressmart://men[/{slug}]`, `dressmart://kids[/{slug}]`, `dressmart://cart`, `dressmart://wishlist`. Android App Links (`https://` + a verified domain) can be added later once a real production domain exists — that's additive, not a replacement.
- **Google Sign-In** (`authService.ts`'s `signInWithGoogle`) uses `signInWithPopup`, a browser-popup flow — this should be functionally tested on a real Android device/emulator inside the Capacitor WebView, since OAuth popups can behave differently there than in a normal browser tab. If it's unreliable, the fix is a native Google Sign-In plugin, not a code change to this doc's scope.
- **Version bump**: `versionCode`/`versionName` in `android/app/build.gradle` are still Capacitor's defaults (`1` / `"1.0"`) — fine for a first upload, remember to increment `versionCode` on every subsequent release.

### Environment Variables

All in `.env` (copy from `.env.example`, gitignored). Nothing Firebase-related is hardcoded in source — `src/lib/firebase.ts` throws a clear startup error if `VITE_USE_FIREBASE_EMULATOR` isn't `'true'` and real credentials are still missing, rather than silently falling back to a demo project.

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Firebase Web app config — Project Settings → General → "Your apps". |
| `VITE_FIREBASE_VAPID_KEY` | Web Push certificate key, for browser/PWA push — Project Settings → Cloud Messaging. |
| `VITE_RAZORPAY_KEY_ID` | Razorpay publishable Key ID (safe for the client). The Key **Secret** lives only in Cloud Functions config (`functions/README.md`), never in this file. |
| `VITE_USE_FIREBASE_EMULATOR` | `true` to force the local emulator suite even if real credentials are present; otherwise defaults to emulator mode only when credentials are missing/placeholder. |
| `VITE_SITE_URL` | Base URL used in password-reset email redirect links. |

### Android Build Instructions

```bash
npm run build          # type-check + production web build → dist/
npx cap sync android    # copy dist/ + plugin config into the native project
cd android
./gradlew assembleDebug   # unsigned debug APK — for local device/emulator testing
./gradlew bundleRelease   # signed release .aab — requires keystore.properties, see Signing above
```

Run on a connected device/emulator directly with `npx cap run android`, or open `android/` in Android Studio for a full IDE (`npx cap open android`).

### Play Store Release Process

1. Confirm `versionCode` was bumped from the last upload (`android/app/build.gradle`).
2. `npm run build && npx cap sync android && cd android && ./gradlew bundleRelease`.
3. Upload `android/app/build/outputs/bundle/release/app-release.aab` to Play Console → your app → Production (or a testing track first).
4. First-ever upload only: enroll in [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756) when prompted — Google then re-signs the app for distribution using its own key, and `dressmart-upload-key.jks` becomes just your upload key, not the final signing key.
5. Fill in the Play Console listing (screenshots, description, privacy policy URL, data-safety form) — outside this repo's scope.

### Production Checklist

- [ ] Real Firebase project created; `.env` filled in with real `VITE_FIREBASE_*` values; `VITE_USE_FIREBASE_EMULATOR=false`.
- [ ] `firebase deploy --only firestore:rules,firestore:indexes,storage` run against the real project.
- [ ] Razorpay Cloud Functions config set (live keys, not test keys) — see `functions/README.md`.
- [ ] Exactly one Head Seller account promoted by hand in the Firestore console.
- [ ] `versionCode`/`versionName` bumped for this release.
- [ ] `android/app/dressmart-upload-key.jks` + `android/keystore.properties` backed up securely outside this repo.
- [ ] `./gradlew bundleRelease` produces a signed `.aab` (verify with `jarsigner -verify`).
- [ ] Physical-device testing checklist below completed at least once.
- [ ] `google-services.json` added and push notifications tested end-to-end, if launching with push enabled (otherwise: ship without it, add later — see below).

### Push Notification Setup (future)

Everything client-side is already scaffolded and inert (see above). To turn it on:

1. In the real Firebase project's console, add an **Android app** with package name `com.dressmart.app`, download `google-services.json`, and place it at `android/app/google-services.json`. `android/app/build.gradle` already conditionally applies the `google-services` Gradle plugin only when this file exists — no Gradle changes needed.
2. Add a dedicated small monochrome notification icon (Android design guideline: transparent + white silhouette only) — without one, Android falls back to the app's full-color launcher icon, which renders poorly in the status bar on some OEM skins.
3. Rebuild (`npx cap sync android`) — `src/lib/pushNotifications.ts`'s `initPushNotifications()` will start actually registering devices and receiving tokens with no further code changes.
4. Persist each device's token (from the `'registration'` listener) to that user's `users/{uid}` Firestore doc — there's a `TODO(production)` comment marking exactly where in `pushNotifications.ts`.
5. Add a Cloud Function (`functions/src`) that reads those tokens and calls `admin.messaging().send(...)` when an order/return/exchange status changes, reusing the existing Firestore-trigger notification pipeline described above.
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
- **A handful of `toast.error(...)` call sites may still show raw text** — the sweep covered auth, checkout/payment, the seller dashboard, and image uploads (the highest-traffic flows); any newly-added mutation should route its error through `getFriendlyErrorMessage` (`src/lib/firebaseErrors.ts`) rather than `error.message` directly.
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
| `npm run seed:curated-formal-shirts` | Seed/update the hand-verified Formal Shirt products from `src/lib/productImages.ts`'s `REAL_PRODUCT_PHOTOGRAPHY` map — additive/idempotent, never touches the rest of the catalog (see `scripts/seedCuratedFormalShirts.ts`'s own docstring for the pattern to follow when curating another category/batch this way) |
| `npx tsx scripts/migrateFormalShirtVariants.ts` | One-off repair for a color/photo data-integrity bug in generically-seeded Formal Shirts (a product's declared color didn't always match what its verified photo actually showed) — safe to re-run any time, a no-op once everything's already correct. Preserves product ids/URLs/reviews/orders; only relabels color/color_hex/sku/tags/image color tags to match the verified truth. Prints a full before/after + flagged-for-review report. |
| `npm run emulators` | Start the local Firebase Emulator Suite (with data persistence) |

`scripts/ensureSeeded.ts` isn't run directly — it's wired into `predev` and auto-seeds only when `products` is empty (see "Reliability" above).

---

## Design System

- **Primary** `#131921` · **Accent** `#FF9900` · **Background** `#F8F8F8` · **Cards** white, rounded-2xl, soft shadows.
- Font: **Poppins**.
- Full dark mode via Tailwind's `class` strategy, toggle in the header.
- Responsive: mobile-first, with dedicated mobile nav drawer and filter drawer.

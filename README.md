# DressMart

Premium online shopping for **Men's** and **Kids' Wear** — a production-grade storefront built with React 19, TypeScript, Tailwind CSS, and Supabase.

![DressMart](https://img.shields.io/badge/status-Phase%201%20%E2%80%94%20Storefront-orange)

---

## What's in this phase

This is the **storefront-first phase** of DressMart: the full customer-facing shopping experience, complete database schema, and a mock data layer so the app runs immediately without any backend setup.

**Included:** Home, category browsing & filters, search, product details, cart, wishlist, full checkout (address → shipping → payment → confirmation), order tracking & history, returns, auth (email, Google, phone OTP), profile/addresses/saved payments/notifications/coupons, static pages, dark mode, and a generated catalog of **~1,700 products** across Men's and Kids' wear.

**Not yet built (next phase):** the separate Admin Dashboard (analytics, inventory, banner/coupon management, user management). The database schema and RLS policies already support it — only the admin UI itself remains.

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
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, Realtime-ready) |
| HTTP | Axios (used for the one non-Supabase external call — pincode lookup) |

---

## Quick Start

```bash
npm install
npm run dev
```

That's it — the app runs immediately in **mock mode**: a full ~1,700-product catalog, auth, cart, orders, everything, backed by an in-memory/localStorage data layer instead of a live database. No `.env` file is required to try the app.

Demo login: **demo@dressmart.com** / **password123**
Demo admin account (for when the admin panel ships): **admin@dressmart.com** / **admin12345**

### Connecting a real Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # only used by the seed script, never shipped to the client
   VITE_USE_MOCK_DATA=false
   ```
3. Run the SQL migrations in `supabase/migrations/` **in order** (`0001` → `0004`) via the Supabase SQL editor, or `supabase db push` if you have the CLI linked.
4. Seed the database with the full generated catalog:
   ```bash
   npm run seed
   ```
   This uses the **same catalog generator** the mock mode uses (`src/lib/catalogGenerator.ts`), so what you see in mock mode is exactly what gets written to your database — brands, categories, ~1,700 products, variants, images, starter coupons, and banners.
5. Restart the dev server. The app now reads and writes through Supabase instead of localStorage — no code changes needed, since every feature goes through `src/services/*`, which branches on `VITE_USE_MOCK_DATA` internally.

---

## Project Structure

```
src/
  assets/           static assets
  components/
    ui/             Button, Input, Modal, Rating, Skeleton, Pagination, ...
    layout/         Header, Footer, CategoryNav, MobileMenu
    product/        ProductCard, ProductGallery, Filters, ColorSwatches, ...
    cart/           CartItemRow, OrderSummary, CouponInput
    common/         SearchBar, Seo, ErrorBoundary
  pages/            one folder per feature area (home, men, kids, product, cart,
                    checkout, orders, auth, profile, wishlist, static, errors)
  features/         reserved for feature-scoped logic as the app grows
  hooks/            useCart, useWishlist, useOrders, useProducts, useSearch, ...
  services/         the data layer — one file per domain, each branches
                    mock vs. Supabase internally (see below)
  lib/              supabase client, catalog generator, utils, query client
  data/             static catalog source data (brands, category taxonomy, colors)
  types/            shared TypeScript types mirroring the DB schema
  contexts/         AuthContext, ThemeContext
  layouts/          MainLayout, AuthLayout, AccountLayout
  routes/           AppRoutes (lazy-loaded), ProtectedRoute

supabase/
  migrations/       0001_init (schema), 0002_rls_policies, 0003_functions,
                    0004_storage — run in order against your project
  functions/
    place-order/    Edge Function: validates stock & places an order atomically
                    server-side (an alternative to the client-side flow used
                    by default)

scripts/
  seed.ts           seeds a real Supabase project with the generated catalog
```

### Why a "mock mode"?

Every feature module (`services/productService.ts`, `services/cartService.ts`, etc.) exposes the same async API regardless of backend. Internally, each function checks `env.useMockData`:

- **Mock mode** (default, no real Supabase project configured): reads/writes to an in-memory catalog (deterministically generated, same every run) plus `localStorage` for user-specific state (cart, wishlist, orders, addresses).
- **Supabase mode**: the exact same functions call `supabase-js` against your real Postgres tables, respecting the RLS policies in `supabase/migrations/0002_rls_policies.sql`.

Nothing in `hooks/` or `pages/` needs to change when you switch modes — the seed script and the mock catalog generator share the same source (`src/lib/catalogGenerator.ts`), so the data is identical either way.

### Product imagery

The catalog is synthetic — there's no licensed product photography to seed with. Every product image is a small, dependency-free SVG generated client-side (`src/lib/placeholderImage.ts`): a garment silhouette in the product's color with a fabric-detail variant per color. This keeps the app fully offline-capable and network-free in mock mode. For production, replace `product_images.url` with real photography uploaded to the `product-images` Supabase Storage bucket (already provisioned in `0004_storage.sql`).

---

## Database Schema

Full schema in `supabase/migrations/0001_init.sql`: `profiles`, `brands`, `categories` (self-referencing for Men/Kids → subcategory hierarchy), `products`, `product_variants`, `product_images`, `reviews`, `addresses`, `cart_items`, `wishlist_items`, `coupons`, `orders`, `order_items`, `order_timeline_events`, `returns`, `saved_payment_methods`, `notifications`, `banners`.

Row Level Security (`0002_rls_policies.sql`) ensures:
- Catalog tables (products, categories, brands, banners, coupons) are publicly readable, admin-writable.
- Personal data (cart, wishlist, addresses, orders, notifications, saved payments) is scoped to `auth.uid()`.
- An `is_admin()` helper function gates admin-only writes, based on `profiles.role`.

`0003_functions.sql` adds a `get_product_facets()` Postgres function (brand/color/size/price-range aggregation for filters) and `decrement_variant_stock()` (atomic stock deduction on order placement).

---

## Payment Integration

Payments are behind a gateway-agnostic abstraction (`src/services/paymentService.ts`). Each method (UPI, Credit/Debit Card, Net Banking, Wallet, COD) implements the same `process()` interface and currently **simulates** a charge (validates input, waits, returns success/failure) — there is no real payment gateway wired up yet. To go live, replace the body of each gateway class with a real call to Razorpay/Stripe/PayU/etc.; nothing in checkout needs to change since it only talks to `paymentService.charge()`.

`supabase/functions/place-order/` is an Edge Function alternative to the default client-side order placement — it validates stock and creates the order + order items atomically server-side, useful once a real payment gateway's webhook needs to trigger order creation.

---

## Known limitations of this phase

- **Guest checkout requires login.** Cart/wishlist work as a guest (a stable per-browser id), but placing an order requires signing in — guest cart items merge into the account automatically on login/signup.
- **Guest cart in Supabase mode** isn't wired up — RLS requires `auth.uid()`, so a live backend needs Supabase Anonymous Auth (`signInAnonymously()`) to support the same guest-cart UX; not implemented in this phase.
- **Phone OTP and password reset** work end-to-end in mock mode (the OTP is shown on-screen for the demo); in Supabase mode they call real `supabase.auth` methods, which require SMS/email providers to be configured in your Supabase project.
- **Admin Dashboard** is not built yet (see "What's in this phase" above).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |
| `npm run seed` | Seed a connected Supabase project with the full catalog |

---

## Deployment

The app is a static Vite build — deploy the `dist/` folder to any static host.

**Vercel / Netlify:**
1. Connect the repo.
2. Build command: `npm run build`. Output directory: `dist`.
3. Set environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, `VITE_USE_MOCK_DATA=false`) in the host's dashboard.
4. Update `VITE_SITE_URL` to your production domain — it's used for auth redirect links (password reset, email confirmation, OAuth).

**Supabase project checklist before going live:**
- Run all four migrations in order.
- Run `npm run seed` (or seed manually) — or connect your real product catalog instead.
- In Supabase Auth settings, enable the Google provider and add your production redirect URL if using Google login.
- Deploy the edge function if you plan to use it: `supabase functions deploy place-order`.
- Replace synthetic product images with real photography in the `product-images` storage bucket.

---

## Design System

- **Primary** `#131921` · **Accent** `#FF9900` · **Background** `#F8F8F8` · **Cards** white, rounded-2xl, soft shadows.
- Font: **Poppins**.
- Full dark mode via Tailwind's `class` strategy, toggle in the header.
- Responsive: mobile-first, with dedicated mobile nav drawer and filter drawer.

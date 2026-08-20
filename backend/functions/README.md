# DressMart Cloud Functions

Firebase Cloud Functions (2nd-gen, `firebase-functions/v2`) backing the DressMart Firestore
marketplace: order placement (COD + Razorpay), order cancellation, seller moderation, and
notification fan-out (in-app doc + FCM push). Runs on the Admin SDK, so it bypasses
`firestore.rules` entirely — see the repo-root `firestore.rules` for what plain client writes are
still allowed to do (status advancement on orders/returns/exchanges), which is what the triggers
below react to.

## Setup

```bash
cd functions
npm install
```

## Required config/secrets

Read via `firebase-functions/params` (see `src/lib/config.ts`):

| Param | Sensitivity | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` | Not secret — echoed back to the client to init Razorpay Checkout | Public key id |
| `RAZORPAY_KEY_SECRET` | Secret | Used to create orders server-side and verify payment signatures |
| `GEMINI_API_KEY` | Secret | Used by `analyzeClothingImage` (visual search) to call the Gemini vision API |

**Local emulator:** copy `.env.example` to `.env` (git-ignored) inside `backend/functions/` and
fill in your Razorpay **test** keys and a Gemini API key (free at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey)):

```bash
# from the repo root
cp backend/functions/.env.example backend/functions/.env
```

**Deployed (production):**

```bash
# One-time, or whenever a secret rotates:
firebase --config database/firebase.json functions:secrets:set RAZORPAY_KEY_SECRET
firebase --config database/firebase.json functions:secrets:set GEMINI_API_KEY

# RAZORPAY_KEY_ID isn't sensitive; set it as a plain deployed param via a project-scoped .env file,
# e.g. backend/functions/.env.<project-id> (also git-ignored), or export it as a build-time env var:
#   backend/functions/.env.production-project-id
#     RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
```

Without `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` set, `createRazorpayOrder` and
`verifyAndPlaceOrder` will throw at runtime when they call `.value()`. Without `GEMINI_API_KEY`
set, Gemini rejects the request (invalid/empty key) and `analyzeClothingImage` maps that to a
friendly "visual search isn't available right now" error instead of a raw 401.

## Local development

```bash
# from the repo root — starts it automatically (see the root README's "Reliability" section)
npm run dev
# or, from backend/functions/:
npm run serve
```

This starts Auth, Firestore, and Functions emulators together (see `database/firebase.json`).
Point the client's `.env` at the emulators (`VITE_USE_EMULATORS=true` or equivalent — see
`frontend/src/lib/firebase.ts`) to exercise these functions end-to-end locally.

## Build / deploy

```bash
npm run build     # tsc -> lib/
npm run deploy    # firebase deploy --only functions
```

`firebase.json`'s `functions.predeploy` already runs `npm --prefix "$RESOURCE_DIR" run build`
before every deploy, so a manual `npm run build` isn't required before `firebase deploy`.

## Callables

All callables require `request.auth` to be set (throw `unauthenticated` otherwise), **except**
`analyzeClothingImage`, which is guest-usable — same as DressMart's existing text search, where
only *recording* search history (done client-side) requires sign-in, not the act of searching.

### `analyzeClothingImage`
```ts
data: { imageBase64: string /* no data: URL prefix */, mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }
returns: {
  garmentType: string;
  gender: 'men' | 'kids' | 'unisex' | null;
  primaryColor: string;
  secondaryColor: string | null;
  pattern: string | null;
  style: string | null;
  sleeveType: string | null;
  fit: string | null;
  confidence: number; // 0-1
}
```
Visual search's AI step. Sends the image to Gemini (`gemini-2.0-flash`) with a strict JSON response
schema and asks it to identify the single primary garment (ignoring background/other people).
Returns attributes **as the AI phrased them** (e.g. `"navy"`, not `"Navy Blue"`) — normalizing
those onto DressMart's actual catalog vocabulary and ranking/searching products happens client-side
in `frontend/src/services/visualSearchService.ts`, which already owns that catalog knowledge; this
callable stays a thin, reusable "photo → clothing attributes" boundary with no product-schema
knowledge of its own. Never persists the uploaded image anywhere (not to Storage, not to Firestore)
— the base64 payload only ever lives in the request body and this function's memory for the
duration of the call.

### `createRazorpayOrder`
```ts
data: { amount: number /* rupees */, receipt: string }
returns: { razorpayOrderId: string, amount: number /* paise */, currency: 'INR', keyId: string }
```
Creates a Razorpay order for `Math.round(amount * 100)` paise.

### `placeCodOrder`
```ts
data: {
  addressId: string;
  couponCode?: string;
  cart: Array<{ productId: string; variantId: string; quantity: number }>;
}
returns: { orderNumber: string, groupId: string }
```
Cash-on-delivery checkout. Validates address ownership, re-reads product/inventory
server-side (never trusts client prices/stock), splits the cart by `seller_id` into one
`orders/{id}` doc per seller (sharing `group_id`/`order_number`), decrements inventory inside a
transaction, deletes the purchased `cart/*` docs, applies+increments a coupon if given, and sends
buyer/seller/low-stock notifications.

### `verifyAndPlaceOrder`
```ts
data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  addressId: string;
  couponCode?: string;
  cart: Array<{ productId: string; variantId: string; quantity: number }>;
}
returns: { orderNumber: string, groupId: string }
```
Verifies `HMAC-SHA256(order_id|payment_id, key_secret) === signature` (throws
`invalid-argument`, `'Payment verification failed'` on mismatch), then runs the exact same
order-placement logic as `placeCodOrder` (shared `src/lib/orderPlacement.ts`), with
`payment_method: 'razorpay'`, `payment_status: 'paid'`.

### `cancelOrder`
```ts
data: { orderId: string }
returns: { success: true }
```
Buyer-only, and only while status is `placed`/`confirmed`/`packed`. Restores inventory
(`variant_stock` + `total_stock`) inside a transaction, appends a `cancelled` timeline event, and
notifies both the seller (`cancelled_order`) and the buyer (`order`).

### `reviewSellerRequest`
```ts
data: { requestId: string; approve: boolean; rejectionReason?: string }
returns: { success: true }
```
Head-Seller-only. Updates the `seller_requests` doc and the applicant's `users/{uid}` doc
(`seller_status`, `seller_approved_at`/`seller_status_reason`) in one batch; role stays `'seller'`
either way. Notifies the applicant.

### `suspendSellerAccount`
```ts
data: { sellerId: string; reason: string; suspend: boolean }
returns: { success: true }
```
Head-Seller-only. Flips `users/{sellerId}.seller_status` between `'suspended'`/`'approved'`; when
suspending, also sets `is_active: false` on every product owned by that seller (batched in chunks
of 400 writes). Notifies the seller.

## Firestore triggers

These are **not** called by the client — Firebase invokes them automatically in reaction to plain
document writes (including this codebase's own admin writes, which is why `onOrderStatusChange`
deliberately ignores the `cancelled` transition — see inline comment).

| Trigger | Fires on | Effect |
|---|---|---|
| `onOrderStatusChange` | `orders/{orderId}` updated, `status` changed | Notifies the buyer (`order`/`delivery` type). Skips `cancelled` (already handled by `cancelOrder`). |
| `onReturnStatusChange` | `returns/{returnId}` updated, `status` changed | Notifies the buyer (`return`), mirrors the new status onto the matching `order.items[].return_status`. |
| `onExchangeStatusChange` | `exchanges/{exchangeId}` updated, `status` changed | Notifies the buyer (`exchange`), mirrors the new status onto the matching `order.items[].exchange_status`. |
| `onSellerRequestCreated` | `seller_requests/{id}` created | Notifies the (single) `head_seller` user (`seller_registration`). |
| `onNotificationCreated` | `notifications/{id}` created | Sends an FCM push to `users/{user_id}.fcm_tokens` via `sendEachForMulticast`; prunes tokens that come back `registration-token-not-registered`. Never throws — logs and swallows push failures. |

## Known gaps / TODOs

- **Coupon rejection is strict**: an invalid/expired/inapplicable `couponCode` throws
  `failed-precondition` rather than silently placing the order without a discount. This seemed
  safer than surprising the buyer with a different total than what they saw at checkout — flag if
  the client instead expects a soft-fail (order placed, discount just not applied).
- **Shipping/tax model** is deliberately simple, per the spec: a flat per-shipment shipping fee
  from `platform_settings/config` (defaulting to the same values as the client's own fallback —
  `shipping_charge: 0`, `free_shipping_threshold: 999`), and tax computed per line as
  `line_subtotal * product.gst_percent / 100`, summed per seller-group (i.e. tax is **not**
  netted against the discount). Revisit if finance/product wants tax computed post-discount.
- **`estimated_delivery`** is a flat "now + 5 days" for every order; no per-seller/per-pincode
  logic.
- **Order-number format** is `ORD${Date.now()}` (shared across every seller-group in one
  checkout). No collision handling beyond millisecond timestamp uniqueness — fine at this scale.
- **`onOrderStatusChange` does not cover every `OrderStatus`** — only the ones that make sense as
  a buyer-facing push after the initial `placed` status (`confirmed`, `packed`, `shipped`,
  `out_for_delivery`, `delivered`, `returned`); `placed` itself is skipped because it's a
  document *create*, not an *update*, and is already notified inside `placeOrderInternal`.
- **`placeCodOrder`/`verifyAndPlaceOrder` are idempotent** via a client-generated `clientRequestId`
  (see `PaymentPage.tsx` / `src/lib/orderPlacement.ts`): a fast-path `order_requests/{id}` doc check
  before the transaction, plus an authoritative re-check inside it, so a double-clicked button or a
  retried network request replays the original result instead of placing a second order.
- The obsolete `supabase/functions/place-order/` (Deno/Supabase, not portable) has been deleted —
  its only useful nuance (a flat-rate tax model) was intentionally **not** carried over, since this
  spec calls for per-line `gst_percent` tax instead.

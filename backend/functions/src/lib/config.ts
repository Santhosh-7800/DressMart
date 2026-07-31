/**
 * Razorpay credentials, read via `firebase-functions/params` (2nd-gen) rather than the deprecated
 * v1 `functions.config()`. See functions/README.md for exactly how to set these before deploy.
 *
 * - RAZORPAY_KEY_ID: not sensitive — it's returned to the client as-is to initialize Razorpay
 *   Checkout, so a plain string param (backed by an env var / .env file) is fine.
 * - RAZORPAY_KEY_SECRET: sensitive — declared as a Secret Manager secret. Any callable that reads
 *   it must list it in its `onCall({ secrets: [razorpayKeySecret] }, ...)` options so the runtime
 *   injects it.
 */
import { defineSecret, defineString } from 'firebase-functions/params';

export const razorpayKeyId = defineString('RAZORPAY_KEY_ID');
export const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');

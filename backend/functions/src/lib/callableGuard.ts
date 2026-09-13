import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Wraps an onCall handler body so an *unexpected* exception (a bug, a transient Firestore/Admin SDK
 * failure, a missing field on a stale document — anything the handler didn't deliberately throw for)
 * never reaches the client as Firebase's bare "internal" error with no message. The callable
 * protocol strips the message from any thrown error that isn't an `HttpsError`, specifically to
 * avoid leaking stack traces/internals to callers — which is correct, but leaves the customer
 * looking at the literal string "internal" with nothing else to go on.
 *
 * A deliberate `HttpsError` thrown by the handler (validation, not-found, payment-verification
 * failure, etc.) already carries a message written for the customer to read, so those pass through
 * untouched. Only genuinely unanticipated errors get logged in full (visible via
 * `firebase functions:log` / Cloud Logging) and replaced with `friendlyMessage`.
 */
export function runCallable<T>(friendlyMessage: string, handler: () => Promise<T>): Promise<T> {
  return handler().catch((error: unknown) => {
    if (error instanceof HttpsError) throw error;
    // Logs the message/stack only, not the raw error object — some upstream SDKs (Razorpay, Admin
    // SDK) can embed request payloads in an error's own properties, which shouldn't end up in
    // Cloud Logging unredacted just because an unexpected exception was thrown.
    logger.error('[callable] unexpected error', { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    throw new HttpsError('internal', friendlyMessage);
  });
}

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
    logger.error('[callable] unexpected error', error);
    throw new HttpsError('internal', friendlyMessage);
  });
}

import Razorpay from 'razorpay';
import { razorpayKeyId, razorpayKeySecret } from './config';

/**
 * Built lazily inside a request handler (never at module scope) — `.value()` on a
 * defineString/defineSecret param is only resolvable once the function is actually invoked.
 */
export function getRazorpayClient(): Razorpay {
  return new Razorpay({
    key_id: razorpayKeyId.value(),
    key_secret: razorpayKeySecret.value(),
  });
}

import { FirebaseError } from 'firebase/app';

/**
 * Firebase's own error messages (e.g. "Firebase: Error (auth/invalid-credential).") are not
 * something to show a user. This maps the common ones — auth failures, offline/unreachable,
 * permission-denied, expired sessions — to a plain-language message; anything unrecognized falls
 * back to a generic message rather than leaking Firebase internals.
 */
const FRIENDLY_MESSAGES: Record<string, string> = {
  // Auth
  // Ambiguous by design on projects with Firebase's email-enumeration protection enabled — it
  // returns this same code for both "no such account" and "wrong password" specifically so a
  // client can't distinguish the two (that's a deliberate anti-enumeration security feature, not
  // something to work around client-side). auth/user-not-found / auth/wrong-password below are the
  // older, split codes still returned by the Auth emulator and by projects without that feature on.
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Choose a stronger password (at least 6 characters).',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/invalid-verification-code': 'That code is incorrect. Please try again.',
  'auth/code-expired': 'That code has expired — request a new one.',
  'auth/invalid-phone-number': 'Enter a valid phone number.',
  'auth/network-request-failed': 'Unable to connect. Please check your internet connection.',
  'auth/requires-recent-login': 'Please sign in again to complete this action.',
  'auth/user-disabled': 'Your account has been disabled. Contact support.',
  'auth/invalid-action-code': 'This reset link is invalid or has already been used — request a new one.',
  'auth/expired-action-code': 'This reset link has expired — request a new one.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for this app yet. Please contact support.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.',
  'auth/account-exists-with-different-credential': 'An account with this email already exists — try signing in a different way.',

  // Firestore / Functions
  unavailable: "Can't reach the server right now. Check your connection and try again.",
  'permission-denied': "You don't have permission to do that.",
  unauthenticated: 'Please sign in to continue.',
  'failed-precondition': 'This action can’t be completed right now.',
  'deadline-exceeded': 'That took too long — please try again.',
  cancelled: 'That was cancelled.',
};

/** Extracts a bare Firebase error code (e.g. "auth/invalid-credential", "permission-denied") from
 *  whatever shape the SDK threw — FirebaseError, a callable's HttpsError-shaped error, or a plain
 *  Error — plus whether it came from a Cloud Function callable specifically (`functions/` prefix). */
function extractCode(error: unknown): { code: string; isCallable: boolean } | null {
  if (error instanceof FirebaseError) {
    const isCallable = error.code.startsWith('functions/');
    return { code: error.code.replace(/^functions\//, ''), isCallable };
  }
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return { code: (error as { code: string }).code, isCallable: false };
  }
  return null;
}

/** Friendly message for any Firebase-originated error, with a caller-supplied fallback for anything unrecognized. */
export function getFriendlyErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const extracted = extractCode(error);
  // Always log the exact code + message the SDK gave us — the UI only ever shows the mapped
  // friendly string below, so this console line is what debugging an auth/Firestore failure
  // actually depends on (e.g. "auth/operation-not-allowed" means the sign-in provider isn't
  // enabled in the Firebase Console, which the friendly message alone can't tell you).
  if (extracted) {
    console.error(`[Firebase] ${extracted.code}${extracted.isCallable ? ' (callable)' : ''}:`, error);
  } else if (error) {
    console.error('[Error]', error);
  }
  if (!navigator.onLine) return 'Unable to connect. Please check your internet connection.';
  // Cloud Function callables (functions/*) throw HttpsError with a message the function author
  // wrote specifically for end users (e.g. `Insufficient stock for "Red Shirt, size M".`) — prefer
  // that actual message over the generic per-code mapping below, which would otherwise discard a
  // deliberately human-authored, specific message in favor of a vague one sharing the same code
  // (e.g. many different callables throw 'failed-precondition' for very different reasons).
  if (extracted?.isCallable && error instanceof Error && error.message) return error.message;
  if (extracted && FRIENDLY_MESSAGES[extracted.code]) return FRIENDLY_MESSAGES[extracted.code];
  if (error instanceof Error && error.message && !extracted) return error.message; // non-Firebase errors (e.g. our own thrown validation messages) pass through as-is
  return fallback;
}

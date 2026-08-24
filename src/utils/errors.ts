import { FirebaseError } from 'firebase/app';

/**
 * Maps Firebase / app errors to a short, user-facing message.
 * Falls back to a generic message so we never leak SDK details into the UI.
 */
export function friendlyError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email or password is incorrect.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again in a minute.';
      case 'auth/network-request-failed':
        return 'Network problem. Check your connection.';
      case 'permission-denied':
        return "You don't have permission to do that.";
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error.';
}
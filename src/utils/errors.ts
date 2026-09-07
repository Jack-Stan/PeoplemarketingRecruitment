/**
 * Maps Firebase / app errors to a short, user-facing message. Dutch: this is
 * the only error text a user ever sees, and the rest of the UI is Dutch.
 * Falls back to a generic message so we never leak SDK details into the UI.
 *
 * Checks for a `.code` string rather than `instanceof FirebaseError` — the
 * SDK's error class doesn't reliably survive `instanceof` across module
 * boundaries in every bundler/test setup, and every Firebase error we care
 * about carries `.code` regardless.
 */
export function friendlyError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'E-mailadres of wachtwoord is onjuist.';
      case 'auth/too-many-requests':
        return 'Te veel pogingen. Probeer het over een minuut opnieuw.';
      case 'auth/network-request-failed':
        return 'Netwerkprobleem. Controleer je verbinding.';
      case 'auth/email-already-in-use':
        return 'Er bestaat al een account met dit e-mailadres.';
      case 'auth/weak-password':
        return 'Het wachtwoord moet minstens 6 tekens lang zijn.';
      case 'auth/invalid-email':
        return 'Geef een geldig e-mailadres op.';
      case 'permission-denied':
        return 'Je hebt geen rechten om dit te doen.';
      default:
        return 'Er ging iets mis. Probeer het opnieuw.';
    }
  }
  // No `.code`: this is one of our own thrown Errors (e.g. the employees
  // store's duplicate-roster guard), whose message is already user copy.
  if (err instanceof Error) return err.message;
  return 'Onbekende fout.';
}

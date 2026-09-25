import type { Timestamp } from 'firebase/firestore';

/**
 * `/invites/{emailLower}` — one per address an admin sent an invite link to.
 * "Open" (not yet completed) is derived, not stored: the invitee can't write
 * here, so an invite counts as done once a `/users` doc with that email
 * exists. See firestore.rules `match /invites`.
 */
export interface Invite {
  email: string;
  officeId: string;
  invitedBy: string;
  /** Null for a moment on the local snapshot before the server timestamp lands. */
  invitedAt: Timestamp | null;
}

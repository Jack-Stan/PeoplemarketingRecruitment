/**
 * User / role / claim types shared across stores, services and views.
 *
 * Three roles per the FRD refinement (Stan confirmed with the client):
 *   - Administrator  (Big Boss — final approver, full access)
 *   - TeamManager    (drafts & submits shifts for their squad)
 *   - TeamMember     (read-only own shifts)
 */
export type Role = 'Administrator' | 'TeamManager' | 'TeamMember';

export const Roles = {
  Administrator: 'Administrator',
  TeamManager: 'TeamManager',
  TeamMember: 'TeamMember',
} as const satisfies Record<Role, Role>;

/** On-screen Dutch labels — role VALUES stay English (DB/rules identifiers), only display text is Dutch. */
export const ROLE_LABELS: Record<Role, string> = {
  Administrator: 'Beheerder',
  TeamManager: 'Teammanager',
  TeamMember: 'Teamlid',
};

export interface AppUser {
  uid: string;
  email: string | null;
  role: Role | null;
  officeId: string | null;
  isTeamLeader: boolean;
}

/**
 * `/users/{uid}` document shape — the ONLY place role/office/isTeamLeader
 * live (no custom claims — see decisions/006). Created by the client at
 * self-signup with `role` and `primaryOfficeId` both null ("authenticated
 * but pending"); from then on only an admin's direct Firestore write (via
 * `usersService.assignRole`, gated by firestore.rules) may change
 * `role`/`primaryOfficeId`/`isTeamLeader`.
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: Role | null;
  primaryOfficeId: string | null;
  /**
   * Which office the person picked at signup — set once at signup and never
   * touched again. Carries no authorization weight (only `primaryOfficeId`
   * does); it's purely a hint so an approving admin knows which office
   * someone actually applied to, since an admin can currently only ever
   * approve into their OWN office (see decisions/005/006). Null for
   * admin-created accounts, which never went through signup.
   */
  desiredOfficeId: string | null;
  isTeamLeader: boolean;
  isActive: boolean;
  /**
   * Admin-set contact number — nothing collects this at signup/invite time,
   * so it starts null and is filled in later from the user detail page.
   * Distinct from an Employee's `phone` (decisions/005 split still applies).
   */
  phone: string | null;
  /**
   * Mirrors Firebase Auth's own `emailVerified` flag onto the Firestore doc —
   * the client SDK can only read the Auth record for the SIGNED-IN user, not
   * other accounts, so this mirror is the only way an admin browsing
   * `/users` can see whether someone else verified their email. Kept
   * trustworthy by firestore.rules: a user can only self-write this field to
   * match `request.auth.token.email_verified`, never an arbitrary value.
   */
  emailVerified: boolean;
  /**
   * No Firebase Phone Auth here — SMS sign-in requires the Blaze plan (see
   * project_spark_plan_no_blaze), so there's no automated OTP to verify
   * against. This is admin-attested only: firestore.rules lets a user reset
   * it to `false` when they change their own number, but only an
   * Administrator may ever flip it to `true` (after confirming by phone).
   */
  phoneVerified: boolean;
}
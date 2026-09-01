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

/**
 * Job function ("functie") — the sales-career ladder, orthogonal to Role
 * (which is an authorization concept). Assigned by an admin alongside the
 * role; shown on the dashboard greeting and the user detail page. Values
 * are the client's own labels verbatim (Dutch/English mix), used as both
 * the stored value and the display text.
 */
export type Functie =
  | 'Trainee'
  | 'Werver'
  | 'Topverkoper'
  | 'Teamcaptain'
  | 'Manager'
  | 'Branch manager'
  | 'Regio manager'
  | 'Country manager';

/** Ordered lowest → highest rung; drives the functie <select> options. */
export const FUNCTIES: readonly Functie[] = [
  'Trainee',
  'Werver',
  'Topverkoper',
  'Teamcaptain',
  'Manager',
  'Branch manager',
  'Regio manager',
  'Country manager',
] as const;

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
  /**
   * Career-ladder functie — admin-assigned via the same modal as role
   * (usersService.assignRole), null until first assignment. Optional-typed
   * because docs created before this field existed simply don't have it.
   */
  functie?: Functie | null;
  isTeamLeader: boolean;
  isActive: boolean;
  /**
   * Contact number — an admin can set it from the user detail page, or the
   * account owner can set their own from Settings. Distinct from an
   * Employee's `phone` (decisions/005 split still applies). No verification
   * concept: real phone verification needs Firebase Phone Auth, which
   * requires the Blaze plan (see project_spark_plan_no_blaze) and is out of
   * scope here — unlike email, there's no free way to confirm it.
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
}
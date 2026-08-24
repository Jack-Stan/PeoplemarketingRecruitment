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
}
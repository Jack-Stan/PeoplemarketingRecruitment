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

export interface AuthClaims {
  role?: Role;
  officeId?: string;
  isTeamLeader?: boolean;
}

export interface AppUser {
  uid: string;
  email: string | null;
  role: Role | null;
  officeId: string | null;
  isTeamLeader: boolean;
}
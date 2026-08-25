import type { RouteRecordRaw } from 'vue-router';

import { Roles, type Role } from '@/types/user';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    roles?: Role[];
    title?: string;
    /** Skip the AppShell nav chrome even though requiresAuth is true — for
     * screens like /pending-approval where the user is signed in but has no
     * role yet, so the Planning/Employees/etc. nav would just be dead links. */
    noShell?: boolean;
  }
}

/**
 * Route table. Lazy-load views to keep initial JS bundle small. Meta:
 *   - requiresAuth: requires a signed-in user
 *   - roles:       allowlist of roles permitted on the route
 *   - title:       document title suffix
 *   - noShell:     requiresAuth but renders without AppShell (see above)
 *
 * Full role-based gating arrives in Ticket 1; for Ticket 0 we only need the
 * `requiresAuth` flag so the guard can bounce unauthenticated users to /login.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { title: 'Login' },
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('@/views/auth/SignupView.vue'),
    meta: { title: 'Create account' },
  },
  {
    path: '/complete-invite',
    name: 'complete-invite',
    component: () => import('@/views/auth/CompleteInviteView.vue'),
    meta: { title: 'Uitnodiging voltooien' },
  },
  {
    path: '/pending-approval',
    name: 'pending-approval',
    component: () => import('@/views/auth/PendingApprovalView.vue'),
    meta: { requiresAuth: true, noShell: true, title: 'Pending approval' },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator, Roles.TeamManager, Roles.TeamMember],
      title: 'Dashboard',
    },
  },
  {
    path: '/planning',
    name: 'planning',
    component: () => import('@/views/PlanningView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator, Roles.TeamManager],
      title: 'Planning',
    },
  },
  {
    path: '/mijn-planning',
    name: 'my-planning',
    component: () => import('@/views/MyPlanningView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.TeamMember],
      title: 'Mijn planning',
    },
  },
  {
    path: '/employees',
    name: 'employees',
    component: () => import('@/views/EmployeesView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator, Roles.TeamManager],
      title: 'Employees',
    },
  },
  {
    path: '/recruitment',
    name: 'recruitment',
    component: () => import('@/views/RecruitmentView.vue'),
    meta: {
      requiresAuth: true,
      // TeamMember gets read-only visibility per the client transcript —
      // `firestore.rules` already only allows a member to read, not write.
      roles: [Roles.Administrator, Roles.TeamManager, Roles.TeamMember],
      title: 'Recruitment',
    },
  },
  {
    path: '/locations',
    name: 'locations',
    component: () => import('@/views/LocationsView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator, Roles.TeamManager, Roles.TeamMember],
      title: 'Locaties',
    },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator, Roles.TeamManager, Roles.TeamMember],
      title: 'History',
    },
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/views/UsersView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator],
      title: 'Users',
    },
  },
  {
    path: '/users/:uid',
    name: 'user-detail',
    component: () => import('@/views/UserDetailView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator],
      title: 'Gebruiker',
    },
  },
  {
    path: '/audit',
    name: 'audit',
    component: () => import('@/views/AuditLogView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator],
      title: 'Audit trail',
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: {
      requiresAuth: true,
      roles: [Roles.Administrator, Roles.TeamManager, Roles.TeamMember],
      title: 'Instellingen',
    },
  },
  {
    path: '/unauthorized',
    name: 'unauthorized',
    component: () => import('@/views/UnauthorizedView.vue'),
    meta: { title: 'Not allowed' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Not found' },
  },
];

/** All roles — convenience for views that want to render role-conditional UI. */
export const allRoles: Role[] = [Roles.Administrator, Roles.TeamManager, Roles.TeamMember];
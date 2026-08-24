import type { RouteRecordRaw } from 'vue-router';

import { Roles, type Role } from '@/types/user';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    roles?: Role[];
    title?: string;
  }
}

/**
 * Route table. Lazy-load views to keep initial JS bundle small. Meta:
 *   - requiresAuth: requires a signed-in user
 *   - roles:       allowlist of roles permitted on the route
 *   - title:       document title suffix
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
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, title: 'Dashboard' },
  },
  {
    path: '/planning',
    name: 'planning',
    component: () => import('@/views/PlanningView.vue'),
    meta: { requiresAuth: true, title: 'Planning' },
  },
  {
    path: '/employees',
    name: 'employees',
    component: () => import('@/views/EmployeesView.vue'),
    meta: { requiresAuth: true, title: 'Employees' },
  },
  {
    path: '/recruitment',
    name: 'recruitment',
    component: () => import('@/views/RecruitmentView.vue'),
    meta: { requiresAuth: true, title: 'Recruitment' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { requiresAuth: true, title: 'History' },
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
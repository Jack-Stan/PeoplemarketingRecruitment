import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/user';

/**
 * Convenience wrapper around the auth store. Use this in views so they
 * stay decoupled from the store shape.
 */
export function useAuth() {
  const store = useAuthStore();
  const { user, role, officeId, isTeamLeader, displayName, isAuthenticated, isLoading, error } =
    storeToRefs(store);

  return {
    ...store,
    user,
    role,
    officeId,
    isTeamLeader,
    displayName,
    isAuthenticated,
    isLoading,
    error,
    hasRole: (...allowed: Role[]) => store.hasRole(...allowed),
  };
}
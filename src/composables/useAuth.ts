import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/user';

/**
 * Convenience wrapper around the auth store. Use this in views so they
 * stay decoupled from the store shape.
 *
 * Every piece of state is returned as a ref via `storeToRefs` and every
 * action is listed explicitly. Spreading the store (`...store`) instead
 * looks equivalent but silently UNWRAPS each ref into a plain value at call
 * time, so `appUser`, `role`, etc. froze at whatever they were when the view
 * first called `useAuth()` and never updated again.
 */
export function useAuth() {
  const store = useAuthStore();
  const {
    user,
    role,
    officeId,
    isTeamLeader,
    displayName,
    functie,
    isAuthenticated,
    isLoading,
    error,
    profileLoadFailed,
    appUser,
    actorLabel,
  } = storeToRefs(store);

  return {
    // state / getters (live refs)
    user,
    role,
    officeId,
    isTeamLeader,
    displayName,
    functie,
    isAuthenticated,
    isLoading,
    error,
    profileLoadFailed,
    appUser,
    actorLabel,
    // actions
    hasRole: (...allowed: Role[]) => store.hasRole(...allowed),
    signIn: store.signIn,
    signUp: store.signUp,
    signOut: store.signOut,
    changeEmail: store.changeEmail,
    resendVerificationEmail: store.resendVerificationEmail,
    refreshEmailVerified: store.refreshEmailVerified,
    sendPasswordReset: store.sendPasswordReset,
    sendInvite: store.sendInvite,
    completeInvite: store.completeInvite,
    hydrate: store.hydrate,
    retryProfileLoad: store.retryProfileLoad,
    clear: store.clear,
  };
}

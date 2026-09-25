import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';

import { useAuth } from '@/composables/useAuth';
import { usersService } from '@/services/users.service';

/**
 * Number of accounts waiting for approval (role === null), for admins only.
 * AppShell (nav badge) and DashboardView (notice) both use it, so one shared
 * listener is ref-counted across callers instead of opening one each.
 */
const count = ref(0);
let unsub: Unsubscribe | null = null;
let users = 0;

function start(): void {
  if (unsub) return;
  unsub = usersService.subscribePendingCount(
    (n) => (count.value = n),
    // Badge just disappears on error; the Users page still shows the truth.
    () => (count.value = 0),
  );
}

function stop(): void {
  unsub?.();
  unsub = null;
  count.value = 0;
}

export function usePendingSignups() {
  const auth = useAuth();
  const isAdmin = computed(() => auth.hasRole('Administrator'));
  let active = false;

  const release = (): void => {
    if (!active) return;
    active = false;
    if (--users === 0) stop();
  };

  watch(
    isAdmin,
    (admin) => {
      if (admin && !active) {
        active = true;
        users++;
        start();
      } else if (!admin) {
        release();
      }
    },
    { immediate: true },
  );
  onBeforeUnmount(release);

  return { pendingCount: computed(() => (isAdmin.value ? count.value : 0)) };
}

import { computed } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useOfficeContextStore } from '@/stores/officeContext';

/**
 * The office every office-scoped view should read/write against. For an
 * Administrator this follows whichever office they've switched to in
 * AppShell's office switcher (defaulting to their own); for a TeamManager or
 * TeamMember it's always their own `primaryOfficeId` — they stay office-
 * locked here exactly as firestore.rules locks them server-side.
 */
export function useActiveOffice() {
  const auth = useAuth();
  const context = useOfficeContextStore();

  const officeId = computed(() => {
    if (auth.role.value === 'Administrator') {
      return context.activeOfficeId ?? auth.officeId.value ?? '';
    }
    return auth.officeId.value ?? '';
  });

  return { officeId };
}

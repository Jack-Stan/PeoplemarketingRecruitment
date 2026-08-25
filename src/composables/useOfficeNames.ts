import { ref } from 'vue';

import { officesService } from '@/services/offices.service';

/**
 * Resolves office IDs to display names — offices are public-readable
 * (decisions/005) so this is a plain fetch, no admin-only read involved.
 * Shared by UsersView and UserDetailView, both of which show which office a
 * user is in/applied to.
 */
export function useOfficeNames() {
  const officeNames = ref<Record<string, string>>({});

  function officeLabel(officeId: string | null): string {
    if (!officeId) return '—';
    return officeNames.value[officeId] ?? officeId;
  }

  async function loadOfficeNames(): Promise<void> {
    const offices = await officesService.listActive();
    officeNames.value = Object.fromEntries(offices.map((o) => [o.officeId, o.name]));
  }

  return { officeNames, officeLabel, loadOfficeNames };
}

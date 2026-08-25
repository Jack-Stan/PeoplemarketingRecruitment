import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Admin-only "which office am I currently managing" context — multi-office
 * support. TeamManager/TeamMember never touch this: they're always scoped to
 * their own office both here (see useActiveOffice) and in firestore.rules.
 * Not persisted across reloads on purpose — an admin lands back on their own
 * office each session, which is the safer default (matches the pre-switch
 * behaviour everywhere except when they deliberately switch).
 */
export const useOfficeContextStore = defineStore('officeContext', () => {
  const activeOfficeId = ref<string | null>(null);

  function setActiveOffice(officeId: string): void {
    activeOfficeId.value = officeId;
  }

  return { activeOfficeId, setActiveOffice };
});

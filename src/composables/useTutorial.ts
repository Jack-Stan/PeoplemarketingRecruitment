import { ref } from 'vue';

import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/stores/auth';

/**
 * First-login rondleiding state. "Seen" lives in two places:
 *   - `tutorialSeenAt` on the caller's own /users doc — the source of truth,
 *     so it follows the account across devices and cleared storage;
 *   - localStorage per uid — instant, and covers the moment before the
 *     profile write lands (or if it's rejected/offline).
 * Either one set means "seen".
 */
const SEEN_KEY_PREFIX = 'pm_tutorial_seen_';

// Module-level so AppShell (which renders the modal) and SettingsView (which
// reopens it) share one flag.
const isOpen = ref(false);

function hasSeen(uid: string): boolean {
  const auth = useAuthStore();
  if (auth.user?.uid === uid && auth.tutorialSeenAt) return true;
  try {
    return localStorage.getItem(SEEN_KEY_PREFIX + uid) === '1';
  } catch {
    // Storage blocked (private mode etc.) — don't nag on every page load.
    return true;
  }
}

function markSeen(uid: string): void {
  try {
    localStorage.setItem(SEEN_KEY_PREFIX + uid, '1');
  } catch {
    /* ignore — the profile write below still records it */
  }
  const auth = useAuthStore();
  if (auth.user?.uid === uid && auth.tutorialSeenAt) return; // already stored
  // Fire-and-forget: cosmetic, must never surface an error or block the UI.
  void usersService.markOwnTutorialSeen(uid).catch(() => undefined);
}

export function useTutorial() {
  return {
    isOpen,
    hasSeen,
    markSeen,
    open: () => (isOpen.value = true),
    close: () => (isOpen.value = false),
  };
}

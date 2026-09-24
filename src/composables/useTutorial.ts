import { ref } from 'vue';

/**
 * First-login rondleiding state. "Seen" is kept per uid in localStorage, not
 * on the /users doc: that would need a new self-writable field in
 * firestore.rules for a purely cosmetic flag. Trade-off: a new browser or
 * cleared storage offers the tour once more — harmless, it's skippable.
 */
const SEEN_KEY_PREFIX = 'pm_tutorial_seen_';

// Module-level so AppShell (which renders the modal) and SettingsView (which
// reopens it) share one flag.
const isOpen = ref(false);

function hasSeen(uid: string): boolean {
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
    /* ignore — worst case the tour is offered again next visit */
  }
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

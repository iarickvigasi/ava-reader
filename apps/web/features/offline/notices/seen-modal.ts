// Tracks whether the "you're offline" modal has auto-surfaced once for this
// browser profile. The chip stays clickable forever; this flag only gates the
// automatic open so we don't nag a user who has already seen the explanation.
// Cleared on sign-out so the next account on this device sees it once too.

const OFFLINE_MODAL_SEEN_KEY = "ava-offline-modal:seen";

export function hasSeenOfflineModal(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(OFFLINE_MODAL_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOfflineModalSeen(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(OFFLINE_MODAL_SEEN_KEY, "1");
  } catch {
    // Ignore storage failures (quota/private browsing); the modal will simply
    // auto-open again next time, which is an acceptable degradation.
  }
}

export function clearOfflineModalSeen(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(OFFLINE_MODAL_SEEN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

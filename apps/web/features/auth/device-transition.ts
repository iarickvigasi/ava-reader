const KEY = "ava-reader:identity-transition";
let waiting = false;

export function isDeviceTransitionPending() {
  try {
    return waiting || !!sessionStorage.getItem(KEY);
  } catch {
    return waiting;
  }
}

export function beginDeviceTransition() {
  waiting = true;
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* Identity remains gated in this tab if storage is unavailable. */
  }
  window.location.replace("/app");
}

export function finishDeviceTransition() {
  waiting = false;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Storage unavailable. */
  }
}

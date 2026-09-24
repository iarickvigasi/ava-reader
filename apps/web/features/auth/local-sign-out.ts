export const SIGN_OUT_KEY = "ava-reader:explicit-sign-out";
export const SESSION_KEY = "ava-reader:last-session";
export const AUTH_CHANGE = "ava-reader:auth-change";

type SignOutIntent = { userId: string; sessionId: string | null };
let memoryIntent: SignOutIntent | null = null;
let memoryOnly = false;

export function readSignOutIntent(): SignOutIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SIGN_OUT_KEY);
    return value
      ? (JSON.parse(value) as SignOutIntent)
      : memoryOnly
        ? memoryIntent
        : null;
  } catch {
    return memoryIntent;
  }
}

export function markSignedOut(userId: string, sessionId: string | null) {
  memoryIntent = { userId, sessionId };
  try {
    window.localStorage.setItem(SIGN_OUT_KEY, JSON.stringify(memoryIntent));
    memoryOnly = false;
  } catch {
    memoryOnly = true;
    /* Keep this tab blocked when persistent storage is unavailable. */
  }
  window.dispatchEvent(new Event(AUTH_CHANGE));
}

export function clearSignOutIntent() {
  memoryIntent = null;
  memoryOnly = false;
  try {
    window.localStorage.removeItem(SIGN_OUT_KEY);
  } catch {
    /* Storage denied. */
  }
  window.dispatchEvent(new Event(AUTH_CHANGE));
}

export function isLocallySignedOut(
  userId: string | null,
  sessionId?: string | null,
) {
  const intent = readSignOutIntent();
  return (
    !!intent &&
    intent.userId === userId &&
    (!sessionId || !intent.sessionId || sessionId === intent.sessionId)
  );
}

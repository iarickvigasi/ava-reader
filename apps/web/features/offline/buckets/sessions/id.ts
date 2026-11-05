// Client-generated session id. Used as the stable key for the offline
// session row AND sent to the server as `clientSessionId` — when the same
// id reaches the server again, only the new checkpoint's extension is credited.
//
// We use crypto.randomUUID where available and fall back to a
// timestamp+random hybrid for very old runtimes. Collision risk is
// negligible at the volume one user generates.

export function generateClientSessionId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

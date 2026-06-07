// Client-generated id for a queued AI comment. Used as the React key + the
// Dexie row id until the server's GET returns its own row (reconciled by
// matching sourceHash on the client side).
export function generateAiCommentId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

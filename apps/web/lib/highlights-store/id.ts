// Client-generated id for new highlights. We send this in the upsert URL,
// which makes the PUT idempotent — the offline queue can retry without ever
// producing a duplicate row.

export function generateHighlightId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback: time + random. Only hit on very old browsers; collision risk
  // is negligible at the volume one user generates highlights.
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

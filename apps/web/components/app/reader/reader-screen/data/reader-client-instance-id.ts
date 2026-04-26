import { READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY } from "../shared/constants";

// Returns a stable id for this browser tab so the server can correlate the
// open / heartbeat / stop session calls. Persisted in sessionStorage so it
// survives in-tab navigations but resets per tab.
export function getOrCreateReaderClientInstanceId() {
  // SSR has no window — just produce a throwaway id.
  if (typeof window === "undefined") {
    return createReaderClientInstanceId();
  }

  try {
    const existingClientInstanceId = window.sessionStorage.getItem(
      READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY,
    );

    if (existingClientInstanceId) {
      return existingClientInstanceId;
    }

    const nextClientInstanceId = createReaderClientInstanceId();
    window.sessionStorage.setItem(
      READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY,
      nextClientInstanceId,
    );
    return nextClientInstanceId;
  } catch {
    // sessionStorage can throw in private modes / blocked storage —
    // fall back to a non-persistent id rather than failing the reader.
    return createReaderClientInstanceId();
  }
}

// Prefers crypto.randomUUID when available; falls back to a timestamp +
// random suffix for very old browsers.
function createReaderClientInstanceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `reader-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

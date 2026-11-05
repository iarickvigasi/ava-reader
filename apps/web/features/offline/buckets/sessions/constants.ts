export const SESSION_CHECKPOINT_MS = 30_000;
export const SESSION_MAX_GAP_MS = 90_000;
export const SESSION_OWNERSHIP_PREFIX = "reading-session:";
export const SESSION_LEASE_KEY = "reading-session-owner";
export const SESSION_REQUEST_TIMEOUT_MS = 15_000;
export const SESSION_TRACKING_VERSION = 2;
export const SESSION_MAX_DURATION_MS = 86_400_000;
export const SESSION_CLOCK_TOLERANCE_MS = 2_000;

export const SESSION_SYNC_STATE = {
  pending: "pending",
  acknowledged: "acknowledged",
  dropped: "dropped",
} as const;

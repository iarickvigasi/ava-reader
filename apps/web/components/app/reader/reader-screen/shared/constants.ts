export const PAGE_GAP = 48;
export const SWIPE_THRESHOLD = 56;
export const SWIPE_MAX_OFF_AXIS = 72;

// Below this page-box width we render the article as a single column;
// at or above it, we render two columns side-by-side.
export const READER_TWO_COLUMN_MIN_WIDTH = 800;

export const READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY =
  "ava-reader:reader-session-client-instance-id";

export const READER_KEY_ESCAPE = "Escape";
export const READER_PANEL_CONTENTS = "contents";
export const READER_VISIBILITY_HIDDEN = "hidden";
export const READER_STATUS_POLL_INTERVAL_MS = 3_000;
export const READER_PROGRESS_PERSIST_DEBOUNCE_MS = 900;
export const READER_SESSION_HEARTBEAT_INTERVAL_MS = 30_000;

export const READER_NAVIGATION_EDGE_START = "start";
export const READER_NAVIGATION_EDGE_END = "end";

export const READER_STATUS_READY = "READY";
export const READER_STATUS_FAILED = "FAILED";
export const READER_STATUS_PROCESSING = "PROCESSING";
export const READER_STATUS_UNSUPPORTED = "UNSUPPORTED";

export const READER_PERSISTENCE_MODE_LOCAL_ONLY = "local-only";
export const READER_PERSISTENCE_MODE_REMOTE = "remote";

export type ReaderPersistenceMode =
  | typeof READER_PERSISTENCE_MODE_LOCAL_ONLY
  | typeof READER_PERSISTENCE_MODE_REMOTE;

export const READER_RESUME_PHASE_SELECTING = "selecting";
export const READER_RESUME_PHASE_APPLYING = "applying";
export const READER_RESUME_PHASE_APPLIED = "applied";

export type ReaderResumePhase =
  | typeof READER_RESUME_PHASE_SELECTING
  | typeof READER_RESUME_PHASE_APPLYING
  | typeof READER_RESUME_PHASE_APPLIED;

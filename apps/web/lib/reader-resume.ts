import type { ReaderLocator, ReaderProgressPayload } from "./api-types";

const READER_RESUME_SNAPSHOT_VERSION = 2;

export type ReaderResumeSnapshotV2 = {
  locator: ReaderLocator;
  savedAt: string;
  version: typeof READER_RESUME_SNAPSHOT_VERSION;
};

export type ReaderResumeSnapshot = ReaderResumeSnapshotV2;

export type ReaderResumeSelection =
  | {
      snapshot: ReaderResumeSnapshot;
      source: "local" | "server";
    }
  | {
      snapshot: null;
      source: "none";
    };

const READER_RESUME_STORAGE_PREFIX = "ava-reader:resume";

export function createReaderResumeStorageKey(libraryItemId: string) {
  return `${READER_RESUME_STORAGE_PREFIX}:${libraryItemId}`;
}

export function createServerResumeSnapshot(
  progress: Pick<ReaderProgressPayload, "lastReadAt" | "locator">,
) {
  if (!progress.locator) {
    return null;
  }

  return {
    locator: progress.locator,
    savedAt: progress.lastReadAt ?? "",
    version: READER_RESUME_SNAPSHOT_VERSION,
  } satisfies ReaderResumeSnapshot;
}

export function parseReaderResumeSnapshot(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ReaderResumeSnapshot>;

    if (
      parsed.version !== READER_RESUME_SNAPSHOT_VERSION ||
      !isReaderLocator(parsed.locator) ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }

    return {
      locator: parsed.locator,
      savedAt: parsed.savedAt,
      version: READER_RESUME_SNAPSHOT_VERSION,
    } satisfies ReaderResumeSnapshot;
  } catch {
    return null;
  }
}

export function selectPreferredReaderResumeSnapshot(input: {
  localSnapshot: ReaderResumeSnapshot | null;
  serverSnapshot: ReaderResumeSnapshot | null;
}): ReaderResumeSelection {
  const { localSnapshot, serverSnapshot } = input;

  if (localSnapshot && serverSnapshot) {
    const localTimestamp = parseSnapshotTimestamp(localSnapshot);
    const serverTimestamp = parseSnapshotTimestamp(serverSnapshot);

    if (
      localTimestamp !== null &&
      serverTimestamp !== null &&
      localTimestamp >= serverTimestamp
    ) {
      return {
        snapshot: localSnapshot,
        source: "local",
      };
    }

    if (localTimestamp !== null && serverTimestamp === null) {
      return {
        snapshot: localSnapshot,
        source: "local",
      };
    }

    if (serverTimestamp !== null && localTimestamp === null) {
      return {
        snapshot: serverSnapshot,
        source: "server",
      };
    }

    if (serverTimestamp !== null && localTimestamp !== null) {
      return {
        snapshot: serverSnapshot,
        source: "server",
      };
    }

    return {
      snapshot: localSnapshot,
      source: "local",
    };
  }

  if (localSnapshot) {
    return {
      snapshot: localSnapshot,
      source: "local",
    };
  }

  if (serverSnapshot) {
    return {
      snapshot: serverSnapshot,
      source: "server",
    };
  }

  return {
    snapshot: null,
    source: "none",
  };
}

export function readLocalReaderResumeSnapshot(libraryItemId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storageKey = createReaderResumeStorageKey(libraryItemId);
    const rawValue = window.localStorage.getItem(storageKey);
    const snapshot = parseReaderResumeSnapshot(rawValue);

    if (!snapshot && rawValue !== null) {
      window.localStorage.removeItem(storageKey);
    }

    return snapshot;
  } catch {
    return null;
  }
}

export function writeLocalReaderResumeSnapshot(
  libraryItemId: string,
  snapshot: ReaderResumeSnapshot,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      createReaderResumeStorageKey(libraryItemId),
      JSON.stringify({
        ...snapshot,
        version: READER_RESUME_SNAPSHOT_VERSION,
      } satisfies ReaderResumeSnapshot),
    );
  } catch {
    // Ignore storage failures so reader progress tracking can continue in-memory.
  }
}

function isReaderLocator(value: unknown): value is ReaderLocator {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ReaderLocator>;

  return (
    typeof candidate.chapterId === "string" &&
    typeof candidate.blockId === "string" &&
    typeof candidate.textOffset === "number" &&
    Number.isFinite(candidate.textOffset) &&
    candidate.textOffset >= 0
  );
}

function parseSnapshotTimestamp(snapshot: ReaderResumeSnapshot) {
  const parsed = Date.parse(snapshot.savedAt);
  return Number.isFinite(parsed) ? parsed : null;
}

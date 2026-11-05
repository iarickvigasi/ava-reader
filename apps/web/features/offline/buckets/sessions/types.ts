import type { SESSION_SYNC_STATE } from "./constants";

export type SessionRow = {
  trackingVersion: 2;
  // Derived transactionally by the table hooks; optional for older stored rows.
  syncState?: (typeof SESSION_SYNC_STATE)[keyof typeof SESSION_SYNC_STATE];
  revision: number;
  acknowledgedRevision: number;
  // Stable identity across checkpoint retries.
  clientSessionId: string;
  libraryItemId: string;
  startedAt: string;
  timeZone: string;
  endedAt: string | null;
  lastHeartbeatAt: string;
  state: "open" | "closed";
  dropped?: boolean;
};

export type SessionLease = {
  ownerId: string;
  clientSessionId: string;
  expiresAt: number;
};

export type CheckpointAck = {
  sessionId: string;
  revision: number;
  durationSeconds: number;
};

export type ReadingClock = {
  wallNow: () => number;
  monotonicNow: () => number;
};

export type ReadingMoment = {
  wallNow: number;
  monotonicNow: number;
};

export type ReadingTick = {
  wallNow: number;
  elapsedMs: number;
  interrupted: boolean;
};

export type ClaimSessionInput = {
  ownerId: string;
  libraryItemId: string;
  now: number;
  exclusive: boolean;
};

export type CheckpointSessionInput = {
  ownerId: string;
  clientSessionId: string;
  tick: ReadingTick;
  stop: boolean;
};

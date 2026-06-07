// Types for the offline-first AI comments bucket. The API enum uses
// uppercase (TRANSLATE / ETYMOLOGY / EXPLAIN); Dexie + the bucket use the
// same casing for consistency with what the reader already passes through.
//
// Mutation envelope mirrors the highlights pattern: one queued mutation per
// comment id at any time (coalesce on enqueue).

import type { ReaderRangeLocator } from "@/lib/api-types";

export type AiCommentKind = "TRANSLATE" | "ETYMOLOGY" | "EXPLAIN";

export type AiCommentStatus = "queued" | "streaming" | "ready" | "failed";

// Single comment as the UI consumes it. Mirrors the AiCommentRecord type
// the in-memory hook used to expose, plus a `status` so the UI can render
// queued / streaming rows distinctly.
export type AiCommentRecord = {
  id: string;
  kind: AiCommentKind;
  sourceText: string;
  body: string;
  targetLang: string | null;
  locator: ReaderRangeLocator | null;
  createdAt: string;
  status: AiCommentStatus;
};

// Shape returned by GET /api/library/:libraryItemId/ai-comments. Locator
// arrives as a parsed object (or null) and `kind` is uppercase.
export type ServerAiComment = {
  id: string;
  kind: AiCommentKind;
  sourceText: string;
  body: string;
  targetLang: string | null;
  locator: ReaderRangeLocator | null;
  createdAt: string;
};

// Discriminated payloads matching the three streaming POST endpoints.
// Carry everything the sync runner needs to replay the call without
// holding onto a Locator object (which the API expects as a JSON string).
export type GenerateTranslatePayload = {
  text: string;
  targetLang: string;
  locator?: string;
};
export type GenerateEtymologyPayload = {
  text: string;
  locator?: string;
};
export type GenerateExplainPayload = {
  text: string;
  context?: string;
  bookTitle?: string;
  author?: string;
  locator?: string;
};

export type PendingMutation =
  | {
      kind: "delete";
      // Targets either a server-confirmed comment (id from a prior GET) or
      // a still-queued local one (id from generateAiCommentId).
      id: string;
      queuedAt: string;
    }
  | {
      kind: "generate.translate";
      // Stable client-side id for the in-flight / queued comment. Used as
      // the React key + the Dexie row id until / unless the server returns
      // a different id and we reconcile.
      id: string;
      payload: GenerateTranslatePayload;
      // Pre-baked locator object kept for the placeholder Dexie row so the
      // reader can underline the range immediately without re-parsing.
      locator: ReaderRangeLocator | null;
      queuedAt: string;
    }
  | {
      kind: "generate.etymology";
      id: string;
      payload: GenerateEtymologyPayload;
      locator: ReaderRangeLocator | null;
      queuedAt: string;
    }
  | {
      kind: "generate.explain";
      id: string;
      payload: GenerateExplainPayload;
      locator: ReaderRangeLocator | null;
      queuedAt: string;
    };

export type Listener = () => void;

export type DropEvent = {
  mutationKind: PendingMutation["kind"];
  commentId: string;
  reason: string;
};
export type DropListener = (event: DropEvent) => void;

export type AiCommentsState = {
  snapshot: AiCommentRecord[];
  pending: PendingMutation[];
};

// Per-book bucket. One in memory; subscribers re-read via
// `selectStableAiComments` keyed by `version`.
export type StorageBucket = {
  state: AiCommentsState;
  listeners: Set<Listener>;
  dropListeners: Set<DropListener>;
  flushing: boolean;
  getToken: (() => Promise<string | null>) | null;
  apiBaseUrl: string;
  version: number;
  derived: AiCommentRecord[];
  derivedVersion: number;
  retryDelayMs: number;
  retryHandle: ReturnType<typeof setTimeout> | null;
  hydratedPromise: Promise<void>;
  // Same fire-and-forget chain as highlights — every persist write is
  // appended here so tests can await it deterministically.
  pendingPersist: Promise<unknown>;
  flushPromise: Promise<void> | null;
};

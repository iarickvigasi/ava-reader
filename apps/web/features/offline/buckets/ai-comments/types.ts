import type { ReaderRangeLocator } from "@/lib/api-types";

export type AiCommentKind = "TRANSLATE" | "ETYMOLOGY" | "EXPLAIN";

export type AiCommentStatus = "queued" | "streaming" | "ready" | "failed";

export type AiCommentRecord = {
  id: string;
  kind: AiCommentKind;
  sourceText: string;
  body: string;
  targetLang: string | null;
  locator: ReaderRangeLocator | null;
  createdAt: string;
  status: AiCommentStatus;
  error: string | null;
};

export type ServerAiComment = Omit<AiCommentRecord, "status" | "error">;

type GenerateContextFields = {
  regenerationId?: string;
  targetLang?: string;
  context?: string;
  bookTitle?: string;
  author?: string;
  locator?: string;
};
export type GenerateTranslatePayload = GenerateContextFields & {
  text: string;
  targetLang: string;
};
export type GenerateEtymologyPayload = GenerateContextFields & {
  text: string;
};
export type GenerateExplainPayload = GenerateContextFields & {
  text: string;
};

export type PendingMutation =
  | {
      kind: "delete";
      id: string;
      queuedAt: string;
    }
  | {
      kind: "generate.translate";
      id: string;
      payload: GenerateTranslatePayload;
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
  pendingPersist: Promise<unknown>;
  flushPromise: Promise<void> | null;
};

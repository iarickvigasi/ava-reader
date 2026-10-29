import type { AvaReaderDB } from "../../../db";
export type CatalogLink = {
  workId: string;
  title: string;
  authors: string[];
  revision: number;
};
export type LinkState = {
  snapshot: CatalogLink | null;
  serverVersion?: number;
  pending: {
    mutationId: string;
    version: number;
    link: CatalogLink | null;
  } | null;
  error: string;
};
export type GetToken = () => Promise<string | null>;
export type LinkRuntime = {
  db: AvaReaderDB;
  records: Map<string, LinkState>;
  listeners: Set<() => void>;
  version: number;
  pendingPersist: Promise<unknown>;
  flushPromise: Promise<void> | null;
  retryHandle: ReturnType<typeof setTimeout> | null;
  retryDelayMs: number;
  getToken: GetToken;
  stopped: boolean;
  stopListening?: () => void;
  hydrated: boolean;
};
export type LinkResult =
  | { kind: "saved"; link: CatalogLink | null; version: number }
  | {
      kind: "drop";
      error: string;
      accepted?: { link: CatalogLink | null; version: number };
    };

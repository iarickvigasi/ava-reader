// Dexie I/O for the AI comments bucket. Two tables:
//   - aiComments         — confirmed-by-server records (mirrors state.snapshot).
//                          Queued / streaming local rows live here too so a
//                          tab reload keeps them visible; the `status` field
//                          tells the UI whether a row is real or pending.
//   - aiCommentMutations — pending writes (mirrors state.pending).
//
// The mutationId == commentId convention (same as highlights) keeps
// idempotent coalescing free via Dexie.put().

import type { AiCommentMutationRow, AiCommentRow } from "../../db";
import { getDb } from "../../db";

import type {
  AiCommentKind,
  AiCommentRecord,
  AiCommentStatus,
  GenerateEtymologyPayload,
  GenerateExplainPayload,
  GenerateTranslatePayload,
  PendingMutation,
} from "./types";

// ----- reads ----------------------------------------------------------------

export async function readStorage(
  libraryItemId: string,
): Promise<{ snapshot: AiCommentRecord[]; pending: PendingMutation[] }> {
  const db = getDb();
  const [rows, mutations] = await Promise.all([
    db.aiComments.where("libraryItemId").equals(libraryItemId).toArray(),
    db.aiCommentMutations
      .where("scopeId")
      .equals(libraryItemId)
      .sortBy("queuedAt"),
  ]);
  return {
    snapshot: rows
      .map(rowToRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    pending: mutations
      .map(mutationRowToPending)
      .filter((m): m is PendingMutation => m !== null),
  };
}

// ----- snapshot writes ------------------------------------------------------

// Replaces every aiComments row for this book with the supplied list. Used
// after a fresh GET — the server is authoritative for the persisted view.
// We deliberately wipe local queued/streaming rows that no longer have a
// matching server row; the canonical replay is the one that landed.
export async function replaceSnapshot(
  libraryItemId: string,
  snapshot: AiCommentRecord[],
): Promise<void> {
  const db = getDb();
  const rows = snapshot.map((record) => recordToRow(libraryItemId, record));
  await db.transaction("rw", db.aiComments, async () => {
    await db.aiComments
      .where("libraryItemId")
      .equals(libraryItemId)
      .delete();
    await db.aiComments.bulkPut(rows);
  });
}

export async function upsertCommentRow(
  libraryItemId: string,
  record: AiCommentRecord,
): Promise<void> {
  const db = getDb();
  await db.aiComments.put(recordToRow(libraryItemId, record));
}

export async function patchCommentStatus(
  libraryItemId: string,
  id: string,
  status: AiCommentStatus,
  bodyAppend?: string,
): Promise<void> {
  const db = getDb();
  const row = await db.aiComments.get([libraryItemId, id]);
  if (!row) {
    return;
  }
  await db.aiComments.put({
    ...row,
    status,
    body: bodyAppend !== undefined ? row.body + bodyAppend : row.body,
  });
}

export async function removeCommentRow(
  libraryItemId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db.aiComments.delete([libraryItemId, id]);
}

// ----- mutation queue writes ------------------------------------------------

export async function upsertPendingMutation(
  libraryItemId: string,
  mutation: PendingMutation,
): Promise<void> {
  const db = getDb();
  await db.aiCommentMutations.put(pendingToRow(libraryItemId, mutation));
}

export async function removePendingMutation(
  commentId: string,
): Promise<void> {
  const db = getDb();
  await db.aiCommentMutations.delete(commentId);
}

// ----- conversions ----------------------------------------------------------

function rowToRecord(row: AiCommentRow): AiCommentRecord {
  return {
    id: row.id,
    kind: row.kind as AiCommentKind,
    sourceText: row.sourceText,
    body: row.body,
    targetLang: row.targetLang,
    locator: row.locator,
    createdAt: row.createdAt,
    status: row.status,
  };
}

function recordToRow(
  libraryItemId: string,
  record: AiCommentRecord,
): AiCommentRow {
  return {
    libraryItemId,
    id: record.id,
    kind: record.kind,
    sourceText: record.sourceText,
    body: record.body,
    targetLang: record.targetLang,
    locator: record.locator,
    createdAt: record.createdAt,
    status: record.status,
  };
}

// We stuff the locator into the generic envelope payload under `_locator`
// so it round-trips without needing a dedicated column. Everything else in
// the payload is the discriminated body the API expects.
type StoredGeneratePayload<TBody> = TBody & {
  _locator?: import("@/lib/api-types").ReaderRangeLocator | null;
};

function mutationRowToPending(
  row: AiCommentMutationRow,
): PendingMutation | null {
  if (row.kind === "delete") {
    return { kind: "delete", id: row.commentId, queuedAt: row.queuedAt };
  }
  if (row.kind === "generate.translate") {
    const stored = row.payload as StoredGeneratePayload<GenerateTranslatePayload>;
    const { _locator, ...payload } = stored;
    return {
      kind: "generate.translate",
      id: row.commentId,
      payload,
      locator: _locator ?? null,
      queuedAt: row.queuedAt,
    };
  }
  if (row.kind === "generate.etymology") {
    const stored = row.payload as StoredGeneratePayload<GenerateEtymologyPayload>;
    const { _locator, ...payload } = stored;
    return {
      kind: "generate.etymology",
      id: row.commentId,
      payload,
      locator: _locator ?? null,
      queuedAt: row.queuedAt,
    };
  }
  if (row.kind === "generate.explain") {
    const stored = row.payload as StoredGeneratePayload<GenerateExplainPayload>;
    const { _locator, ...payload } = stored;
    return {
      kind: "generate.explain",
      id: row.commentId,
      payload,
      locator: _locator ?? null,
      queuedAt: row.queuedAt,
    };
  }
  return null;
}

function pendingToRow(
  libraryItemId: string,
  mutation: PendingMutation,
): AiCommentMutationRow {
  const base = {
    // mutationId == commentId: there's at most one pending mutation per
    // comment id at a time (mutations.ts coalesces). Reusing the id as the
    // primary key gives free idempotent replacement via Dexie.put().
    mutationId: mutation.id,
    scopeId: libraryItemId,
    queuedAt: mutation.queuedAt,
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: null,
    commentId: mutation.id,
  };
  if (mutation.kind === "delete") {
    return { ...base, kind: "delete", payload: {} };
  }
  // Locator stuffed into payload._locator so it round-trips through the
  // generic envelope without needing a dedicated column.
  return {
    ...base,
    kind: mutation.kind,
    payload: {
      ...mutation.payload,
      _locator: mutation.locator,
    } as Record<string, unknown>,
  };
}

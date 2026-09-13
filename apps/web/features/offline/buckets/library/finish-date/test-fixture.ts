import { getDb, type ProgressRow, type SessionRow } from "../../../db";
import { hydrateBookInfo, hydrateFromPayload, readBookInfo } from "../bucket";
import { book as membershipBook } from "../membership/test-fixture";
import { payload } from "../test-fixture";

export const finishedAt = "2026-09-13T12:34:56.000Z";
export const priorFinishedAt = "2026-09-01T10:00:00.000Z";
export const book = { ...membershipBook, minutesRead: 42, finishedAt: null };
export const token = async () => "token";

const progress: ProgressRow = {
  libraryItemId: book.libraryItemId,
  locator: { chapterId: "chapter-2", blockId: "paragraph-5", textOffset: 17 },
  completionPercent: book.completionPercent,
  lastReadAt: "2026-09-12T10:30:00.000Z",
  lastLocalUpdateAt: "2026-09-12T10:30:00.000Z",
  lastServerUpdateAt: "2026-09-12T10:30:00.000Z",
  dirty: false,
};
const session: SessionRow = {
  libraryItemId: book.libraryItemId,
  clientSessionId: "session-1",
  serverSessionId: "server-session-1",
  startedAt: "2026-09-12T10:00:00.000Z",
  endedAt: "2026-09-12T10:30:00.000Z",
  lastHeartbeatAt: "2026-09-12T10:30:00.000Z",
  state: "closed",
  syncedAt: "2026-09-12T10:30:00.000Z",
};

export async function seedFinishDateFixture(baseline: string | null = null) {
  await hydrateFromPayload(payload());
  await hydrateBookInfo({ ...book, finishedAt: baseline });
  await getDb().progress.put(progress);
  await getDb().sessions.put(session);
}

export async function readingState() {
  const details = await readBookInfo(book.slug);
  return {
    completionPercent: details?.completionPercent,
    minutesRead: details?.minutesRead,
    lastReadAt: details?.lastReadAt,
    progress: await getDb().progress.toArray(),
    sessions: await getDb().sessions.toArray(),
  };
}

export function acknowledgment(value: string | null) {
  return Response.json({ libraryItemId: book.libraryItemId, finishedAt: value });
}

export function deferredResponse() {
  let respond!: (response: Response) => void;
  let announce!: () => void;
  const response = new Promise<Response>((resolve) => { respond = resolve; });
  const started = new Promise<void>((resolve) => { announce = resolve; });
  return { respond, started, fetch: () => { announce(); return response; } };
}

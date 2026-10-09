import type { AvaReaderDB } from "../../db";

export const MAX_OFFLINE_CHAPTERS = 10_000;
type Coverage = { identity: string; chapterIds: string[] };
export const downloadCoverageKey = (id: string) =>
  `book-download-coverage:${id}`;

export function validChapterOrder(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_OFFLINE_CHAPTERS &&
    ids.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= 256,
    ) &&
    new Set(ids).size === ids.length
  );
}

export async function readDownloadCoverage(
  db: AvaReaderDB,
  id: string,
): Promise<Coverage | null> {
  const value = (await db.meta.get(downloadCoverageKey(id)))?.value as
    | Partial<Coverage>
    | undefined;
  return value &&
    typeof value.identity === "string" &&
    value.identity.length > 0 &&
    value.identity.length <= 512 &&
    validChapterOrder(value.chapterIds)
    ? (value as Coverage)
    : null;
}

export async function recordDownloadCoverage(
  db: AvaReaderDB,
  id: string,
  identity: string,
  written: string[],
) {
  if (!identity || identity.length > 512)
    throw new Error("Offline content identity exceeds its bound");
  const previous = await readDownloadCoverage(db, id);
  const chapterIds = [
    ...new Set([
      ...(previous?.identity === identity ? previous.chapterIds : []),
      ...written,
    ]),
  ];
  if (!validChapterOrder(chapterIds))
    throw new Error("Offline coverage exceeds its bound");
  await db.meta.put({
    key: downloadCoverageKey(id),
    value: { identity, chapterIds },
    updatedAt: new Date().toISOString(),
  });
}

export async function readCoveredChapterIds(
  db: AvaReaderDB,
  id: string,
  identity: string,
): Promise<Set<string>> {
  return db.transaction("r", [db.bookChapters, db.meta], async () => {
    const coverage = await readDownloadCoverage(db, id);
    if (coverage?.identity !== identity) return new Set();
    const keys = await db.bookChapters
      .where("[libraryItemId+chapterId]")
      .between([id, ""], [id, "￿"])
      .primaryKeys();
    const stored = new Set(keys.map((entry) => entry[1]));
    return new Set(
      coverage.chapterIds.filter((chapterId) => stored.has(chapterId)),
    );
  });
}

export async function clearDownloadCoverage(db: AvaReaderDB, id: string) {
  await db.meta.delete(downloadCoverageKey(id));
}

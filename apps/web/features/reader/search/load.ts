import type {
  ReaderChapterPayload,
  ReaderStatusPayload,
} from "@/lib/api-types/reader";
import {
  requireDownloadPayload,
  downloadContentIdentity,
} from "@/features/offline/buckets/book/download-payload";
import { searchPassages } from "./passages";
import { readerLeaves } from "@/features/reader/jump-target";
import { MAX_SEARCH_CHARACTERS, MAX_SEARCH_CHAPTERS } from "./types";

type Ready = Extract<ReaderStatusPayload, { status: "READY" }>;

// Canonical packages already contain the complete immutable book. Legacy books
// use the authoritative ordered manifest, since Contents can omit chapters.
// Missing content is an error, never an apparently complete zero-result search.
export async function loadSearchPassages(
  initial: Ready,
  fetchChapter: (id: string) => Promise<ReaderStatusPayload>,
  signal: AbortSignal,
) {
  const check = () => {
    signal.throwIfAborted();
  };
  check();
  if (initial.readerPackage) return searchPassages(initial);
  requireDownloadPayload(initial, initial.book.libraryItemId);
  const ids = initial.chapterIds!;
  if (ids.length > MAX_SEARCH_CHAPTERS)
    throw new Error("Search corpus limit exceeded");
  const identity = downloadContentIdentity(initial)!;
  const positions = new Map(ids.map((id, index) => [id, index]));
  const chapters = new Map<string, ReaderChapterPayload>();
  let characters = 0;
  const add = (chapter: ReaderChapterPayload) => {
    const index = positions.get(chapter.chapterId);
    if (
      index === undefined ||
      chapter.previousChapterId !== (ids[index - 1] ?? null) ||
      chapter.nextChapterId !== (ids[index + 1] ?? null)
    )
      throw new Error("Inconsistent search chapter order");
    const previous = chapters.get(chapter.chapterId);
    if (previous) {
      if (JSON.stringify(previous.blocks) !== JSON.stringify(chapter.blocks))
        throw new Error("Search chapter content changed");
      return;
    }
    characters += readerLeaves(chapter.blocks).reduce(
      (sum, block) => sum + block.text.length,
      0,
    );
    if (
      characters > MAX_SEARCH_CHARACTERS ||
      chapters.size >= MAX_SEARCH_CHAPTERS
    )
      throw new Error("Search corpus limit exceeded");
    chapters.set(chapter.chapterId, chapter);
  };
  for (const chapter of initial.chapters) add(chapter);
  const get = async (id: string): Promise<ReaderChapterPayload> => {
    check();
    if (!chapters.has(id)) {
      const next = await fetchChapter(id);
      check();
      requireDownloadPayload(next, initial.book.libraryItemId, identity);
      if (
        next.readerPackage ||
        JSON.stringify(next.chapterIds) !== JSON.stringify(ids)
      )
        throw new Error("Search content changed or unavailable");
      for (const chapter of next.chapters) add(chapter);
    }
    const chapter = chapters.get(id);
    if (!chapter) throw new Error("Search chapter unavailable");
    return chapter;
  };
  if (!ids.includes(initial.activeChapterId))
    throw new Error("Search active chapter unavailable");
  const ordered: ReaderChapterPayload[] = [];
  for (const id of ids) ordered.push(await get(id));
  check();
  return searchPassages(initial, ordered);
}

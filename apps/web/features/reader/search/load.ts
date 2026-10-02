import type {
  ReaderChapterPayload,
  ReaderStatusPayload,
} from "@/lib/api-types/reader";
import { searchPassages } from "./passages";
import { readerLeaves } from "@/features/reader/jump-target";
import { MAX_SEARCH_CHARACTERS, MAX_SEARCH_CHAPTERS } from "./types";

type Ready = Extract<ReaderStatusPayload, { status: "READY" }>;

// Canonical packages already contain the complete immutable book. Legacy books
// follow chapter adjacency, since Contents can omit front matter or chapters.
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
  const chapters = new Map<string, ReaderChapterPayload>();
  let characters = 0;
  const add = (chapter: ReaderChapterPayload) => {
    if (chapters.has(chapter.chapterId)) return;
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
      if (
        next.status !== "READY" ||
        next.book.libraryItemId !== initial.book.libraryItemId ||
        next.readerPackage
      )
        throw new Error("Search content changed or unavailable");
      for (const chapter of next.chapters) add(chapter);
    }
    const chapter = chapters.get(id);
    if (!chapter) throw new Error("Search chapter unavailable");
    return chapter;
  };
  let first = await get(initial.activeChapterId);
  const seen = new Set<string>([first.chapterId]);
  while (first.previousChapterId) {
    if (seen.has(first.previousChapterId))
      throw new Error("Cyclic search chapters");
    first = await get(first.previousChapterId);
    seen.add(first.chapterId);
  }
  const ordered: ReaderChapterPayload[] = [];
  const visited = new Set<string>();
  let current: ReaderChapterPayload | null = first;
  while (current) {
    check();
    if (ordered.length >= MAX_SEARCH_CHAPTERS || visited.has(current.chapterId))
      throw new Error("Invalid search chapter chain");
    if (current.previousChapterId !== (ordered.at(-1)?.chapterId ?? null))
      throw new Error("Inconsistent search chapter chain");
    ordered.push(current);
    visited.add(current.chapterId);
    current = current.nextChapterId ? await get(current.nextChapterId) : null;
  }
  return searchPassages(initial, ordered);
}

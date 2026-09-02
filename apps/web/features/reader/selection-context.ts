import type {
  ReaderBlock,
  ReaderChapterPayload,
  ReaderRangeLocator,
} from "@/lib/api-types";
import {
  segmentSentences,
  type SentenceSegment,
} from "./sentence-segments";

// Hard ceiling for the derived context string. The server accepts up to 8 KB;
// anything past a couple of sentences stops helping the prompt.
export const MAX_CONTEXT_CHARS = 1500;

// Derives the prompt context for a selection: the sentence(s) of the start
// block that overlap the selected range, preceded by the sentence before.
// Returns null whenever the context cannot be derived (no locator, chapter
// outside the loaded window, textless block, no Intl.Segmenter) — callers
// send the request without context in that case.
export function extractSelectionContext(
  chapters: ReaderChapterPayload[],
  locator: ReaderRangeLocator | null,
): string | null {
  if (!locator) return null;
  const start = findStartBlock(chapters, locator);
  if (!start) return null;
  const sentences = segmentSentences(start.block.text);
  if (!sentences || sentences.length === 0) return null;
  const selection = clampSelectionToBlock(locator, start.block.text.length);
  const containing = sentencesOverlapping(sentences, selection);
  if (containing.length === 0) return null;
  const previous = sentenceBefore(sentences, containing[0], start);
  return composeContext(previous, containing);
}

type StartBlock = { block: ReaderBlock; blocks: ReaderBlock[]; index: number };

function findStartBlock(
  chapters: ReaderChapterPayload[],
  locator: ReaderRangeLocator,
): StartBlock | null {
  const chapter = chapters.find((c) => c.chapterId === locator.chapterId);
  if (!chapter) return null;
  const index = chapter.blocks.findIndex(
    (block) => block.id === locator.startBlockId,
  );
  if (index === -1) return null;
  const block = chapter.blocks[index];
  if (!hasSentenceText(block)) return null;
  return { block, blocks: chapter.blocks, index };
}

// The locator's offsets were measured against the rendered DOM, which can
// drift from `block.text` by a few characters (see spec 5.2) — clamp, never
// trust them to land exactly. A selection that crosses into a later block
// simply extends to the end of the start block.
function clampSelectionToBlock(
  locator: ReaderRangeLocator,
  textLength: number,
): { start: number; end: number } {
  const start = Math.min(Math.max(locator.startOffset, 0), textLength - 1);
  const sameBlock = locator.endBlockId === locator.startBlockId;
  const rawEnd = sameBlock ? locator.endOffset : textLength;
  return { start, end: Math.min(Math.max(rawEnd, start + 1), textLength) };
}

function sentencesOverlapping(
  sentences: SentenceSegment[],
  selection: { start: number; end: number },
): SentenceSegment[] {
  return sentences.filter(
    (sentence) =>
      sentence.end > selection.start && sentence.start < selection.end,
  );
}

function sentenceBefore(
  sentences: SentenceSegment[],
  firstContaining: SentenceSegment,
  start: StartBlock,
): SentenceSegment | undefined {
  const index = sentences.indexOf(firstContaining);
  if (index > 0) return sentences[index - 1];
  return lastSentenceOfPrecedingBlock(start.blocks, start.index);
}

function lastSentenceOfPrecedingBlock(
  blocks: ReaderBlock[],
  blockIndex: number,
): SentenceSegment | undefined {
  for (let index = blockIndex - 1; index >= 0; index -= 1) {
    const candidate = blocks[index];
    if (!hasSentenceText(candidate)) continue;
    return segmentSentences(candidate.text)?.at(-1);
  }
  return undefined;
}

// Over the cap, cut from the beginning: the tail is nearest the selection's
// own sentence, the head (the previous sentence) matters least.
function composeContext(
  previous: SentenceSegment | undefined,
  containing: SentenceSegment[],
): string {
  const parts = [previous?.text, ...containing.map((s) => s.text)];
  const joined = collapseWhitespace(parts.filter(Boolean).join(" "));
  return joined.length <= MAX_CONTEXT_CHARS
    ? joined
    : joined.slice(-MAX_CONTEXT_CHARS);
}

function hasSentenceText(block: ReaderBlock): boolean {
  // Image blocks carry alt text in `text`; alt text is not prose context.
  return block.kind !== "image" && block.text.trim().length > 0;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

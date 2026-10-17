import type { ReaderTocNode } from './reader-types';

// Compact progress index — stored alongside the derived-reader BookFile so
// that recomputing progress metrics on every locator update does not require
// loading and JSON-parsing the full reader package (which can be tens of MB
// for a large book). Contains only the fields `computeProgressMetrics` reads:
// total block count, per-chapter block ids and titles, and the TOC.
export type ReadingProgressIndexChapter = {
  blockIds: string[];
  chapterId: string;
  // v2+: whether this chapter's blocks count toward completion, per the
  // chapter-purpose analysis. Absent on v1 indexes, where every block counts.
  counted?: boolean;
  label: string;
  title: string;
};

// v2 adds the body-only fields. They are a derived cache, exactly like
// `blockIds` — `BookAnalysis.result` stays the source of truth, so a change to
// the counting policy is a backfill from stored purposes, never an AI re-run.
export type ReadingProgressIndex = {
  // v2+: total blocks across counted chapters. Absent on v1.
  bodyBlocks?: number;
  chapters: ReadingProgressIndexChapter[];
  toc: ReaderTocNode[];
  totalBlocks: number;
  version: 1 | 2;
};

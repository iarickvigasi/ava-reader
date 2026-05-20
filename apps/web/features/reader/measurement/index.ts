// Public surface of the reader measurement module.
//
// The reader needs to map between two coordinate systems: published
// locators (chapterId + blockId + textOffset) that survive across
// re-imports, and on-screen page indices that depend on the current
// viewport, font size, and column count. Each chapter is measured once
// into a `ReaderMeasurementEntry`; the entry's closures answer "what
// locator is on page N?" and "what page is this locator on?" on demand.
//
// Module map:
// - geometry.ts      — PageMetrics, page-window math, page-count
// - dom-segments.ts  — DOM walking: block lookup, text nodes, ranges
// - resolve.ts       — the two locator ↔ page resolvers + binary search

import type { ReaderLocator } from "@/lib/api-types";
import { resolvePageCount, resolvePageMetrics } from "./geometry";
import {
  type ReaderMeasurementPageResolution,
  resolveLocatorFromPageIndex,
  resolvePageIndexFromLocator,
} from "./resolve";

export type { ReaderMeasurementPageResolution };

export type ReaderMeasurementEntry =
  | {
      chapterId: string;
      layoutKey: string;
      pageCount: number;
      status: "failed" | "pending";
    }
  | {
      chapterId: string;
      layoutKey: string;
      pageCount: number;
      // When the visible reader prepends a single-page previous chapter,
      // the active chapter's first visible spread starts at column 2 of
      // preloader spread 0. Pass `columnOffset: 2` so the search begins at
      // the column the user actually sees first; otherwise the published
      // locator points to content the user already saw with the previous
      // chapter and resume lands one page early.
      resolveLocator: (
        pageIndex: number,
        columnOffset?: 1 | 2,
      ) => ReaderLocator | null;
      resolvePageIndex: (
        locator: ReaderLocator,
      ) => ReaderMeasurementPageResolution;
      status: "ready";
    };

export function createPendingReaderMeasurementEntry(input: {
  chapterId: string;
  layoutKey: string;
}): ReaderMeasurementEntry {
  return {
    chapterId: input.chapterId,
    layoutKey: input.layoutKey,
    pageCount: 1,
    status: "pending",
  };
}

export function createFailedReaderMeasurementEntry(input: {
  chapterId: string;
  layoutKey: string;
}): ReaderMeasurementEntry {
  return {
    chapterId: input.chapterId,
    layoutKey: input.layoutKey,
    pageCount: 1,
    status: "failed",
  };
}

export function createReadyReaderMeasurementEntry(input: {
  article: HTMLElement;
  chapterId: string;
  columnCount: 1 | 2;
  layoutKey: string;
  pageBox: HTMLElement;
  pageGap: number;
}): ReaderMeasurementEntry {
  const metrics = resolvePageMetrics(
    input.pageBox,
    input.pageGap,
    input.columnCount,
  );

  if (!metrics) {
    return createPendingReaderMeasurementEntry({
      chapterId: input.chapterId,
      layoutKey: input.layoutKey,
    });
  }

  const pageCount = resolvePageCount(input.article, metrics);

  // The closures below re-call resolvePageMetrics on each invocation rather
  // than capturing `metrics`. `pageBoxLeft` (a viewport-relative coordinate)
  // can drift between when the entry is built and when callers query it;
  // re-reading the live element on demand keeps resolutions correct without
  // forcing the entry to be rebuilt on every reflow.
  return {
    chapterId: input.chapterId,
    layoutKey: input.layoutKey,
    pageCount,
    resolveLocator(pageIndex, columnOffset = 1) {
      return resolveLocatorFromPageIndex({
        article: input.article,
        chapterId: input.chapterId,
        columnOffset,
        metrics: resolvePageMetrics(
          input.pageBox,
          input.pageGap,
          input.columnCount,
        ),
        pageCount,
        pageIndex,
      });
    },
    resolvePageIndex(locator) {
      return resolvePageIndexFromLocator({
        article: input.article,
        locator,
        metrics: resolvePageMetrics(
          input.pageBox,
          input.pageGap,
          input.columnCount,
        ),
      });
    },
    status: "ready",
  };
}

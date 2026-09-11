"use client";

import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { readBookContent } from "@/features/offline/buckets/book";
import { collectTocChapterEntries } from "@/features/reader/toc";
import type { ReaderTocNode } from "@/lib/api-types";

const EMPTY_LABELS = new Map<string, string>();

export function useCachedChapterLabels(libraryItemId: string) {
  const [result, setResult] = useState({ libraryItemId, labels: EMPTY_LABELS });
  useEffect(() => {
    const subscription = liveQuery(() => readBookContent(libraryItemId)).subscribe({
      next: (book) => {
        const toc = Array.isArray(book?.toc) ? book.toc as ReaderTocNode[] : [];
        const entries = collectTocChapterEntries(toc);
        const labels = new Map(Array.from(entries, ([id, entry]) => [id, entry.label]));
        setResult({ libraryItemId, labels });
      },
      error: () => setResult({ libraryItemId, labels: EMPTY_LABELS }),
    });
    return () => subscription.unsubscribe();
  }, [libraryItemId]);
  return result.libraryItemId === libraryItemId ? result.labels : EMPTY_LABELS;
}

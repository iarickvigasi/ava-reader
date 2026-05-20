"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useHighlights } from "./use-highlights";
import type {
  HighlightColor,
  HighlightRecord,
} from "@/features/highlights";
import type { ReaderRangeLocator } from "@/lib/api-types";

export type HighlightsContextValue = {
  highlights: HighlightRecord[];
  upsertHighlight: (input: {
    id?: string;
    excerpt: string;
    color: HighlightColor;
    locator: ReaderRangeLocator | null;
  }) => string;
  deleteHighlight: (id: string) => void;
};

const HighlightsContext = createContext<HighlightsContextValue | null>(null);

// Single source of truth for both the right (color picker) and left
// (aggregated list) panels. Mounting the hook here ensures we run one fetch
// + one subscription per book, regardless of how many consumers read state.
export function HighlightsProvider({
  libraryItemId,
  children,
}: {
  libraryItemId: string;
  children: ReactNode;
}) {
  const value = useHighlights(libraryItemId);
  return (
    <HighlightsContext.Provider value={value}>
      {children}
    </HighlightsContext.Provider>
  );
}

export function useHighlightsContext() {
  const value = useContext(HighlightsContext);
  if (!value) {
    throw new Error(
      "useHighlightsContext must be used within a HighlightsProvider.",
    );
  }
  return value;
}

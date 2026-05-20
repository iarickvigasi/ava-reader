"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ReaderRangeLocator } from "@/lib/api-types";
import type { HighlightColor } from "@/features/reader/highlights";

type ReaderSelectionContextValue = {
  text: string | null;
  locator: ReaderRangeLocator | null;
  // When the panel is open against an existing highlight (because the user
  // clicked one in the article, or because we matched their fresh selection
  // to a stored highlight), these point at the row the swatch click should
  // operate on. Null when the selection hasn't produced/matched a highlight.
  highlightId: string | null;
  highlightColor: HighlightColor | null;
  setSelection: (next: {
    text: string;
    locator: ReaderRangeLocator | null;
    highlightId?: string | null;
    highlightColor?: HighlightColor | null;
  }) => void;
  setHighlightBinding: (
    next: { highlightId: string; highlightColor: HighlightColor } | null,
  ) => void;
  clearSelection: () => void;
};

const ReaderSelectionContext =
  createContext<ReaderSelectionContextValue | null>(null);

export function ReaderSelectionProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const [locator, setLocator] = useState<ReaderRangeLocator | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [highlightColor, setHighlightColor] = useState<HighlightColor | null>(
    null,
  );

  const setSelection = useCallback<ReaderSelectionContextValue["setSelection"]>(
    ({
      text: nextText,
      locator: nextLocator,
      highlightId: nextHighlightId = null,
      highlightColor: nextHighlightColor = null,
    }) => {
      setText(nextText);
      setLocator(nextLocator);
      setHighlightId(nextHighlightId);
      setHighlightColor(nextHighlightColor);
    },
    [],
  );

  const setHighlightBinding = useCallback<
    ReaderSelectionContextValue["setHighlightBinding"]
  >((next) => {
    setHighlightId(next?.highlightId ?? null);
    setHighlightColor(next?.highlightColor ?? null);
  }, []);

  const clearSelection = useCallback(() => {
    setText(null);
    setLocator(null);
    setHighlightId(null);
    setHighlightColor(null);
  }, []);

  const value = useMemo<ReaderSelectionContextValue>(
    () => ({
      text,
      locator,
      highlightId,
      highlightColor,
      setSelection,
      setHighlightBinding,
      clearSelection,
    }),
    [
      text,
      locator,
      highlightId,
      highlightColor,
      setSelection,
      setHighlightBinding,
      clearSelection,
    ],
  );

  return (
    <ReaderSelectionContext.Provider value={value}>
      {children}
    </ReaderSelectionContext.Provider>
  );
}

export function useReaderSelectionContext() {
  const value = useContext(ReaderSelectionContext);

  if (!value) {
    throw new Error(
      "useReaderSelectionContext must be used within a ReaderSelectionProvider.",
    );
  }

  return value;
}

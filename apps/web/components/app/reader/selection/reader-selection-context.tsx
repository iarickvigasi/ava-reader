"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { ReaderRangeLocator } from "@/lib/api-types";
import type { HighlightColor } from "@/features/offline/buckets/highlights";
import type { SelectionPointer } from "./types";

import type { ReaderSelectionContextValue } from "./reader-selection-value";

const ReaderSelectionContext =
  createContext<ReaderSelectionContextValue | null>(null);

export function ReaderSelectionProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const [locator, setLocator] = useState<ReaderRangeLocator | null>(null);
  const [pointer, setPointer] = useState<SelectionPointer | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [contextOffset, setContextOffset] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [highlightColor, setHighlightColor] = useState<HighlightColor | null>(
    null,
  );

  const setSelection = useCallback<ReaderSelectionContextValue["setSelection"]>(
    ({
      text: nextText,
      locator: nextLocator,
      pointer: nextPointer = null,
      context: nextContext = null,
      contextOffset: nextContextOffset = null,
      highlightId: nextHighlightId = null,
      highlightColor: nextHighlightColor = null,
    }) => {
      setText(nextText);
      setLocator(nextLocator);
      setPointer(nextPointer);
      setContext(nextContext);
      setContextOffset(nextContextOffset);
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
    setPointer(null);
    setContext(null);
    setContextOffset(null);
    setHighlightId(null);
    setHighlightColor(null);
  }, []);

  const value: ReaderSelectionContextValue = {
    text,
    locator,
    pointer,
    context,
    contextOffset,
    highlightId,
    highlightColor,
    setSelection,
    setHighlightBinding,
    clearSelection,
  };

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

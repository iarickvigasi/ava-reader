"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AiCommentLocator } from "@/lib/api-types";

type ReaderSelectionContextValue = {
  text: string | null;
  locator: AiCommentLocator | null;
  setSelection: (next: {
    text: string;
    locator: AiCommentLocator | null;
  }) => void;
  clearSelection: () => void;
};

const ReaderSelectionContext =
  createContext<ReaderSelectionContextValue | null>(null);

export function ReaderSelectionProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const [locator, setLocator] = useState<AiCommentLocator | null>(null);

  const setSelection = useCallback<ReaderSelectionContextValue["setSelection"]>(
    ({ text: nextText, locator: nextLocator }) => {
      setText(nextText);
      setLocator(nextLocator);
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setText(null);
    setLocator(null);
  }, []);

  const value = useMemo<ReaderSelectionContextValue>(
    () => ({ text, locator, setSelection, clearSelection }),
    [text, locator, setSelection, clearSelection],
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

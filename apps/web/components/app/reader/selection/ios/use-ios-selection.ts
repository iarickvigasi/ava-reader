"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { ReaderSelection } from "../types";
import { createIosSelectionCapture } from "./create-ios-selection-capture";
import { isIosTouch } from "./is-ios-touch";

type UseIosSelectionParams = {
  containerRef: RefObject<HTMLElement | null>;
  onSelectText: (selection: ReaderSelection) => void;
  disabled: boolean;
  // The painted selection belongs to one page of one chapter: paint made for
  // any other page is stale, and reads as empty.
  pageKey: string;
};

const NO_RECTS: DOMRect[] = [];
const subscribeToNothing = () => () => {};

// The iOS half of selection (spec 1.6 Behaviour 8). Returns the line rects to
// paint; an empty list on every other platform, where the OS still draws it.
export function useIosSelection({
  containerRef,
  onSelectText,
  disabled,
  pageKey,
}: UseIosSelectionParams): { isActive: boolean; rects: DOMRect[] } {
  // Read through the store so the server (and the hydration pass) sees the
  // non-iOS answer and the markup matches.
  const isActive = useSyncExternalStore(
    subscribeToNothing,
    () => isIosTouch(window),
    () => false,
  );

  const [painted, setPainted] = useState<{ key: string; rects: DOMRect[] }>({
    key: pageKey,
    rects: NO_RECTS,
  });

  const onSelectRef = useRef(onSelectText);
  const pageKeyRef = useRef(pageKey);
  useEffect(() => {
    onSelectRef.current = onSelectText;
    pageKeyRef.current = pageKey;
  }, [onSelectText, pageKey]);

  const paint = useCallback((range: Range | null) => {
    setPainted({
      key: pageKeyRef.current,
      rects: range ? Array.from(range.getClientRects()) : NO_RECTS,
    });
  }, []);

  useEffect(() => {
    if (!isActive || disabled) {
      return;
    }

    const capture = createIosSelectionCapture({
      win: window,
      doc: document,
      getContainer: () => containerRef.current,
      onPaint: paint,
      onCapture: (selection) => onSelectRef.current(selection),
    });

    return () => capture.destroy();
  }, [containerRef, disabled, isActive, paint]);

  return {
    isActive,
    rects: painted.key === pageKey ? painted.rects : NO_RECTS,
  };
}

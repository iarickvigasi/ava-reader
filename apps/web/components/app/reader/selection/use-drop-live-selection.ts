"use client";

import { useLayoutEffect } from "react";
import { isIosTouch } from "./ios/is-ios-touch";
import { useReaderSelectionContext } from "./reader-selection-context";

// The AI toolbox is the reason the native callout must not render, so the
// panel owns the drop: called from the toolbox overlay, this removes the live
// selection before first paint whenever the panel is up against a touch-made
// capture — callout and panel never coexist, and no capture path mutates the
// selection itself. Mouse captures keep their selection (desktop has no
// callout), as do opens from highlight/comment clicks (pointer is null).
// Re-runs on every fresh capture in case one lands while the panel is open.
// iOS never gets here: it has no native selection to drop (spec 2.6 §8).
export function useDropLiveSelection() {
  const { pointer, locator, text } = useReaderSelectionContext();

  useLayoutEffect(() => {
    if (pointer !== "touch" || isIosTouch(window)) {
      return;
    }
    window.getSelection()?.removeAllRanges();
  }, [pointer, locator, text]);
}

"use client";

import { useEffect } from "react";

const OVERSCROLL_BEHAVIOR_NONE = "none";

/**
 * Pins the document against overscroll while `enabled`, restoring whatever was
 * set before on cleanup.
 *
 * The reader shell is exactly one viewport tall and never scrolls, so a drag
 * with a vertical component has nothing to move — but without this, mobile
 * WebKit still rubber-bands the whole page. That vertical travel is not
 * cosmetic: it changes the visual viewport, which re-keys the pagination
 * measurement cache and re-paginates the chapter mid-swipe (see spec
 * 1.2-pagination "reflow"). Set on both the element and the body because the
 * two share the viewport's scroll box and engines disagree on which one wins.
 */
export function useLockDocumentOverscroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const { body, documentElement } = document;
    const previousRootOverscroll = documentElement.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    documentElement.style.overscrollBehavior = OVERSCROLL_BEHAVIOR_NONE;
    body.style.overscrollBehavior = OVERSCROLL_BEHAVIOR_NONE;

    return () => {
      documentElement.style.overscrollBehavior = previousRootOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [enabled]);
}

"use client";
import { useLayoutEffect } from "react";
import type { GridFocusRestorationOptions } from "./types";
export function useGridFocusRestoration({
  items,
  columns,
  ref,
  focusedId,
  focusedHref,
}: GridFocusRestorationOptions) {
  useLayoutEffect(() => {
    if (!focusedId || document.activeElement !== document.body) return;
    const target = [
      ...(ref.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []),
    ].find(
      (link) =>
        link.closest<HTMLElement>("[data-catalog-work]")?.dataset
          .catalogWork === focusedId &&
        link.getAttribute("href") === focusedHref,
    );
    target?.focus({ preventScroll: true });
  }, [items, columns, focusedId, focusedHref, ref]);
}

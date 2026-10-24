"use client";

import { gridAnchorTarget } from "./grid-anchor-target";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { CatalogWork } from "@/lib/catalog-types";
import type { GridViewport } from "./use-grid-viewport";

export function useGridAnchor(
  items: CatalogWork[],
  viewport: GridViewport,
  ref: RefObject<HTMLElement | null>,
) {
  const previous = useRef<{
    items: CatalogWork[];
    viewport: GridViewport;
  } | null>(null);
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = { items, viewport };
    if (!old?.items.length || !items.length || !ref.current) return;
    if (
      old.items === items &&
      old.viewport.columns === viewport.columns &&
      old.viewport.rowHeight === viewport.rowHeight
    )
      return;
    const top = ref.current.getBoundingClientRect().top + window.scrollY;
    const target = gridAnchorTarget(old.items, items, old.viewport, {
      ...viewport,
      top,
    });
    if (target === null) return;
    if (Math.abs(target - window.scrollY) > 1)
      window.scrollTo({ top: Math.max(0, target), behavior: "instant" });
  }, [items, viewport, ref]);
}

"use client";

import { useLayoutEffect, useEffect } from "react";
import type { VirtualCatalogGridOptions } from "./types";
import { useGridFocusRestoration } from "./use-grid-focus-restoration";
import { restoreVirtualGrid } from "./restore-virtual-grid";
import { useIsCatalogAdmin } from "../admin/use-is-catalog-admin";
import { useGridViewport } from "./use-grid-viewport";
import { useGridAnchor } from "./use-grid-anchor";
import { virtualCatalogRange } from "./virtual-catalog-range";

export function useVirtualCatalogGrid({
  items,
  ref,
  focusedId,
  focusedHref,
  setAnchor,
  restoreRef,
}: VirtualCatalogGridOptions) {
  useLayoutEffect(() => {
    restoreRef.current = (scroll, anchor) =>
      restoreVirtualGrid(ref.current, items, scroll, anchor);
    return () => {
      restoreRef.current = null;
    };
  }, [ref, items, restoreRef]);
  const admin = useIsCatalogAdmin();
  const viewport = useGridViewport(ref, admin);
  useGridAnchor(items, viewport, ref);
  const firstRow = Math.max(
    0,
    Math.floor((viewport.scroll - viewport.top) / viewport.rowHeight),
  );
  const anchorId = items[firstRow * viewport.columns]?.id ?? null;
  useEffect(() => setAnchor(anchorId), [anchorId, setAnchor]);
  useGridFocusRestoration({
    items,
    columns: viewport.columns,
    ref,
    focusedId,
    focusedHref,
  });
  const rows = virtualCatalogRange(
    items.length,
    viewport.columns,
    viewport.rowHeight,
    viewport.scroll - viewport.top,
    viewport.height,
    items.findIndex((work) => work.id === focusedId),
  );
  return {
    height: Math.ceil(items.length / viewport.columns) * viewport.rowHeight,
    rows: rows.map((index) => ({
      index,
      top: index * viewport.rowHeight,
      height: viewport.rowHeight - 32,
      items: items.slice(
        index * viewport.columns,
        (index + 1) * viewport.columns,
      ),
    })),
  };
}

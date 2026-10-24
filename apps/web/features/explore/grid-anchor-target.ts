import type { CatalogWork } from "@/lib/catalog-types";
import type { GridViewport } from "./measure-grid-viewport";

export function gridAnchorTarget(
  oldItems: CatalogWork[],
  items: CatalogWork[],
  old: GridViewport,
  current: GridViewport,
) {
  if (!oldItems.length || !items.length) return null;
  const row = Math.max(
    0,
    Math.min(
      Math.floor((old.scroll - old.top) / old.rowHeight),
      Math.ceil(oldItems.length / old.columns) - 1,
    ),
  );
  const index = items.findIndex(
    (work) => work.id === oldItems[row * old.columns]?.id,
  );
  if (index < 0) return null;
  const offset = old.top + row * old.rowHeight - old.scroll;
  return Math.max(
    0,
    current.top +
      Math.floor(index / current.columns) * current.rowHeight -
      offset,
  );
}

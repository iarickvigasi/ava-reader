import type { RefObject } from "react";
import type { CatalogWork } from "@/lib/catalog-types";
import { restoreFeedPosition, type FeedAnchor } from "./feed-position";
import { measureGridViewport } from "./measure-grid-viewport";

export type GridRestorer = RefObject<
  ((scroll: number, anchor?: FeedAnchor) => () => void) | null
>;

export function restoreVirtualGrid(
  grid: HTMLElement | null,
  items: CatalogWork[],
  scroll: number,
  anchor?: FeedAnchor,
) {
  const viewport = grid && measureGridViewport(grid);
  const index = items.findIndex(
    (work) => `/app/explore/books/${work.id}` === anchor?.path,
  );
  if (!grid || !viewport || !anchor || index < 0)
    return restoreFeedPosition(scroll, anchor);
  const sample = grid.querySelector<HTMLElement>("h3");
  const row = sample?.closest<HTMLElement>("[data-catalog-row]");
  const headingOffset =
    sample && row
      ? sample.getBoundingClientRect().top - row.getBoundingClientRect().top
      : viewport.rowHeight - 132;
  const target =
    viewport.top +
    Math.floor(index / viewport.columns) * viewport.rowHeight +
    headingOffset -
    anchor.top;
  const frame = requestAnimationFrame(() =>
    window.scrollTo({ top: Math.max(0, target), behavior: "instant" }),
  );
  return () => cancelAnimationFrame(frame);
}

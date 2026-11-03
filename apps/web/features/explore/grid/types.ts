import type { RefObject } from "react";
import type { CatalogWork } from "@/lib/catalog-types";
import type { FeedAnchor } from "../feed/types";
export type GridViewport = {
  columns: number;
  rowHeight: number;
  top: number;
  scroll: number;
  height: number;
};

export type GridRestorer = RefObject<
  ((scroll: number, anchor?: FeedAnchor) => () => void) | null
>;

export type VirtualCatalogGridOptions = {
  items: CatalogWork[];
  ref: RefObject<HTMLElement | null>;
  focusedId: string | null;
  focusedHref: string | null;
  setAnchor: (id: string | null) => void;
  restoreRef: GridRestorer;
};

export type GridFocusRestorationOptions = Pick<
  VirtualCatalogGridOptions,
  "items" | "ref" | "focusedId" | "focusedHref"
> & { columns: number };

"use client";

import type { GridRestorer } from "@/features/explore/restore-virtual-grid";
import type { RefObject, FocusEventHandler } from "react";
import type { CatalogWork } from "@/lib/catalog-types";
import { useVirtualCatalogGrid } from "@/features/explore/use-virtual-catalog-grid";
import { EXPLORE_GRID_CLASS_NAME } from "./explore-layout";
import { BookCardSkeleton } from "@/components/app/shared/books/book-card-skeleton";
import { CatalogBookCard } from "./catalog-book-card";

export function CatalogVirtualGrid({
  items,
  gridRef,
  label,
  focusedId,
  focusedHref,
  setAnchor,
  restoreRef,
  onFocus,
  onBlur,
  loading,
  busy,
}: {
  items: CatalogWork[];
  gridRef: RefObject<HTMLElement | null>;
  label: string;
  loading: boolean;
  busy: boolean;
  focusedId: string | null;
  focusedHref: string | null;
  setAnchor: (id: string | null) => void;
  restoreRef: GridRestorer;
  onFocus: FocusEventHandler<HTMLElement>;
  onBlur: FocusEventHandler<HTMLElement>;
}) {
  const grid = useVirtualCatalogGrid(
    items,
    gridRef,
    focusedId,
    focusedHref,
    setAnchor,
    restoreRef,
  );
  return (
    <section
      ref={gridRef}
      aria-label={label}
      aria-busy={busy}
      onFocusCapture={onFocus}
      onBlurCapture={onBlur}
      className={`${EXPLORE_GRID_CLASS_NAME} relative`}
      style={{
        height: loading ? undefined : grid.height,
      }}
    >
      {loading &&
        Array.from({ length: 10 }, (_, index) => (
          <BookCardSkeleton key={index} />
        ))}
      {!loading &&
        grid.rows.map((row) => (
          <div
            key={row.index}
            data-catalog-row={row.index}
            className={`${EXPLORE_GRID_CLASS_NAME} absolute inset-x-0`}
            style={{
              top: row.top,
              height: row.height,
            }}
          >
            {row.items.map((work) => (
              <CatalogBookCard key={work.id} work={work} uniformCover />
            ))}
          </div>
        ))}
    </section>
  );
}

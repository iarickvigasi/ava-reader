"use client";

import type { GridRestorer } from "./restore-virtual-grid";
import { useMemo, useRef, useState, type FocusEvent } from "react";

export function useCatalogFocus() {
  const restoreRef: GridRestorer = useRef(null);
  const [focus, setFocus] = useState<{
    id: string;
    href: string | null;
  } | null>(null);
  const [anchorId, setAnchor] = useState<string | null>(null);
  const focusedId = focus?.id ?? null;
  const protectedIds = useMemo(
    () => [focusedId, anchorId].filter((id): id is string => !!id),
    [focusedId, anchorId],
  );
  return {
    restoreRef,
    focusedId,
    focusedHref: focus?.href ?? null,
    protectedIds,
    setAnchor,
    onFocus: (event: FocusEvent<HTMLElement>) => {
      const target = event.target as Element;
      const id = target.closest<HTMLElement>("[data-catalog-work]")?.dataset
        .catalogWork;
      setFocus(
        id
          ? { id, href: target.closest("a")?.getAttribute("href") ?? null }
          : null,
      );
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null))
        setFocus(null);
    },
  };
}

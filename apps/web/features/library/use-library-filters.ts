"use client";

import { useSyncExternalStore } from "react";
import { parseLibraryFilters, type LibraryFilter } from "./library-filters";

const EVENT = "ava:library-query";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(EVENT, listener);
  };
}

export function useLibraryFilters() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const filters = parseLibraryFilters(search);
  function toggle(filter: LibraryFilter) {
    const selected = parseLibraryFilters(window.location.search);
    const next = selected.includes(filter)
      ? selected.filter((value) => value !== filter)
      : [...selected, filter];
    const params = new URLSearchParams(window.location.search);
    if (next.length) params.set("filters", next.join(","));
    else params.delete("filters");
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`,
    );
    window.dispatchEvent(new Event(EVENT));
  }
  return { filters, toggle };
}

"use client";

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}

export function useCatalogLocation(kind: "books" | "authors") {
  const location = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
    () => "",
  );
  const prefix = `/app/explore/${kind}/`;
  const id = location.startsWith(prefix)
    ? location.slice(prefix.length).split(/[/?]/)[0]
    : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  )
    ? id
    : location
      ? "invalid"
      : null;
}

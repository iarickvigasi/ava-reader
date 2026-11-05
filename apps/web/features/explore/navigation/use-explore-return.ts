"use client";

import { useSyncExternalStore } from "react";
import { exploreReturn } from "./explore-return";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("ava:explore-query", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("ava:explore-query", listener);
  };
}

export function useExploreReturn() {
  const location = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
    () => "/app/explore",
  );
  return exploreReturn(location);
}

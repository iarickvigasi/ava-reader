"use client";

import { CATALOG_FILTERS } from "./catalog-filters";
import { useSyncExternalStore } from "react";

const EVENT = "ava:explore-query";
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(EVENT, listener);
  };
}

export function useExploreQuery() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const params = new URLSearchParams(search);
  const query = params.get("q")?.slice(0, 200) ?? "";
  const languages = params.get("languages")?.split(",").filter(Boolean) ?? [];
  const filters =
    params
      .get("filters")
      ?.split(",")
      .filter((value) => CATALOG_FILTERS.some((known) => known === value)) ??
    [];
  function update(key: string, values: string[]) {
    const next = new URLSearchParams(window.location.search);
    next.delete(key);
    next.delete("after");
    values.forEach((value) => next.append(key, value));
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${next.size ? `?${next}` : ""}`,
    );
    window.dispatchEvent(new Event(EVENT));
  }
  function toggle(key: "languages" | "filters", value: string) {
    const selected = key === "languages" ? languages : filters;
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    if (key === "languages" && next.length > 20) return;
    update(key, next.length ? [next.join(",")] : []);
  }
  return {
    query,
    languages,
    filters,
    toggle,
    setQuery: (value: string) => update("q", value ? [value] : []),
  };
}

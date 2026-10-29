"use client";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { adminRequest } from "./admin-request";

export function useAuthorSearch(query: string) {
  const { getToken } = useOfflineAuth();
  const [state, setState] = useState<{
    query: string;
    authors: { id: string; displayName: string }[];
    error: string;
  }>({ query: "", authors: [], error: "" });
  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void adminRequest<{ id: string; displayName: string }[]>(
        `authors?query=${encodeURIComponent(query)}`,
        getToken,
        undefined,
        controller.signal,
      )
        .then((data) => {
          if (!controller.signal.aborted) {
            setState({ query, authors: data, error: "" });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setState({ query, authors: [], error: "Author search failed" });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, getToken]);
  const matches = query.length >= 2 && state.query === query;
  return {
    authors: matches ? state.authors : [],
    error: matches ? state.error : "",
    loading: query.length >= 2 && !matches,
  };
}

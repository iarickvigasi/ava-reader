"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import type { LibraryBookInfo } from "@/lib/api-types/library";
import { readBookInfoBySlug } from "./read-book-info";

// Subscribe to details and queued membership edits; the first render retains
// the supplied payload so the server and client agree during hydration.
export function useBookInfo(slug: string, initial: LibraryBookInfo): LibraryBookInfo {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const subscription = liveQuery(() => readBookInfoBySlug(slug)).subscribe({
      next: (book) => { if (book) setValue(book); },
      error: () => {},
    });
    return () => subscription.unsubscribe();
  }, [slug]);
  return value.slug === slug ? value : initial;
}

"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import type { CurrentUserPayload } from "@/lib/api-types/user";
import { readCurrentReadingBook } from "./read-current-reading-book";

export function useCurrentReadingBook() {
  const [book, setBook] =
    useState<CurrentUserPayload["currentReadingBook"]>(null);
  useEffect(() => {
    const subscription = liveQuery(readCurrentReadingBook).subscribe({
      next: setBook,
      error: () => setBook(null),
    });
    return () => subscription.unsubscribe();
  }, []);
  return book;
}

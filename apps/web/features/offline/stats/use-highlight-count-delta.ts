"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { readHighlightCountDelta } from "./read-highlight-count-delta";

export function useHighlightCountDelta(): number {
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    const subscription = liveQuery(readHighlightCountDelta).subscribe({
      next: setDelta,
      error: () => {},
    });
    return () => subscription.unsubscribe();
  }, []);
  return delta;
}

"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { readAvatarBlob } from "./storage";

// undefined = resolving, null = absent. Data URLs keep cached profile photos
// independent of object-URL revocation and IndexedDB blob lifetimes on Safari.
export function useAvatarBlobUrl(): string | null | undefined {
  const [resolved, setResolved] = useState<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    let reader: FileReader | null = null;
    let cancelled = false;
    const stopReading = () => {
      if (!reader) return;
      reader.onload = reader.onerror = null;
      reader.abort();
      reader = null;
    };
    const subscription = liveQuery(readAvatarBlob).subscribe({
      next: (blob) => {
        if (cancelled) return;
        stopReading();
        if (!blob) {
          setResolved(null);
          return;
        }
        const current = new FileReader();
        reader = current;
        current.onload = () => {
          if (!cancelled && reader === current)
            setResolved(
              typeof current.result === "string" ? current.result : null,
            );
        };
        current.onerror = () => {
          if (!cancelled && reader === current) setResolved(null);
        };
        current.readAsDataURL(blob);
      },
      error: () => {
        stopReading();
        if (!cancelled) setResolved(null);
      },
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      stopReading();
    };
  }, []);
  return resolved;
}

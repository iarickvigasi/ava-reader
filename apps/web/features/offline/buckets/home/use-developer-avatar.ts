"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { getDb } from "../../db";
import { cacheDeveloperAvatar } from "./developer-avatars";

export function useDeveloperAvatar(id: string, url: string | null) {
  const [cached, setCached] = useState<{
    id: string;
    src: string | null;
  } | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    const db = getDb();
    const subscription = liveQuery(() =>
      db.meta.get(`developer-avatar:${id}`),
    ).subscribe({
      next: (row) => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        const value = row?.value as { blob?: Blob } | undefined;
        objectUrl = value?.blob ? URL.createObjectURL(value.blob) : null;
        setCached({ id, src: objectUrl });
      },
      error: () => setCached({ id, src: null }),
    });
    const refresh = () => {
      if (url) void cacheDeveloperAvatar(id, url);
    };
    refresh();
    window.addEventListener("online", refresh);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("online", refresh);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, url]);
  return cached?.id === id ? (cached.src ?? url) : null;
}

"use client";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import {
  revalidateLibrary,
  refreshFromDb,
  setCatalogLink,
  useLibraryView,
  type CatalogLink,
} from "@/features/offline/buckets/library";
import type { CatalogWork } from "@/lib/catalog-types";
export function usePrivateLinkDialog(
  initialId: string | undefined,
  initialWork: CatalogWork | undefined,
  close: () => void,
) {
  const { getToken } = useOfflineAuth();
  const library = useLibraryView();
  const [id, setId] = useState(initialId ?? "");
  const [work, setWork] = useState(initialWork ?? null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    void refreshFromDb();
    void revalidateLibrary(getToken).catch(() => {});
  }, [getToken]);
  async function save() {
    if (!id || !work || pending) return;
    setPending(true);
    try {
      const link: CatalogLink = {
        workId: work.id,
        title: work.originalTitle,
        authors: work.credits
          .filter((credit) => credit.role === "AUTHOR")
          .map((credit) => credit.author.displayName),
        revision: work.revision ?? 1,
      };
      await setCatalogLink(id, link, getToken);
      close();
    } catch {
      setError("Could not save the link on this device. Try again.");
    } finally {
      setPending(false);
    }
  }
  return {
    id,
    setId,
    work,
    chooseWork: setWork,
    uploads: library?.books.filter((book) => book.source === "IMPORTED") ?? [],
    error,
    pending,
    save,
  };
}

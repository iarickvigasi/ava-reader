"use client";
import { useEffect, useState } from "react";
import { useOfflineAuth } from "@/features/auth/use-offline-auth";
import { adminRequest } from "../admin/admin-request";
import { fetchCatalog } from "@/lib/catalog-api";
import type { CatalogWork } from "@/lib/catalog-types";
export type EditionChoice = {
  id: string;
  title: string;
  revision: number;
  workId: string;
  language: string | null;
};
export function useEditionWorkDialog(
  kind: string,
  id: string,
  close: () => void,
) {
  const { getToken } = useOfflineAuth();
  const [work, setWork] = useState<CatalogWork | null>(null);
  const [edition, setEdition] = useState<EditionChoice | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load =
      kind === "works"
        ? fetchCatalog<CatalogWork>(`works/${id}`, controller.signal).then(
            setWork,
          )
        : adminRequest<EditionChoice>(
            `editions/${id}`,
            getToken,
            undefined,
            controller.signal,
          ).then(setEdition);
    void load.catch(() => {
      if (!controller.signal.aborted)
        setError("Could not load the current description");
    });
    return () => controller.abort();
  }, [kind, id, getToken]);
  async function save() {
    if (!work || !edition || pending) return;
    setPending(true);
    setError("");
    try {
      await adminRequest("edition-work", getToken, {
        editionId: edition.id,
        workId: work.id,
        revision: edition.revision,
        workRevision: work.revision,
      });
      window.dispatchEvent(new Event("ava:catalog-updated"));
      close();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Link failed; retry to finish updating review references",
      );
    } finally {
      setPending(false);
    }
  }
  return {
    work,
    setWork,
    edition,
    setEdition,
    error,
    pending,
    save,
  };
}

"use client";

import { useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import type { LibraryBookInfo } from "@/lib/api-types";
import { updateBookCollections } from "@/features/offline/buckets/library";
import { collectionChanges } from "./collection-changes";
import { useCollectionOptions } from "./use-collection-options";
import { selectDraftMemberships } from "./select-draft-memberships";

export function useCollectionPicker({
  libraryItemId, memberships, onClose,
}: {
  libraryItemId: string;
  memberships: LibraryBookInfo["collections"];
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const t = useTranslations("library.bookInfo.collectionPicker");
  const options = useCollectionOptions();
  const initialIds = new Set(
    memberships.filter(({ kind }) => kind === "CUSTOM").map(({ id }) => id),
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const selectedIds = selectDraftMemberships(initialIds, overrides);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const changes = collectionChanges(options.collections, initialIds, selectedIds);
  const dirty = changes.addCollectionIds.length + changes.removeCollectionIds.length > 0;

  function close() {
    if (!submitting.current) onClose();
  }

  function toggle(id: string) {
    if (submitting.current) return;
    setError(null);
    setOverrides((prior) => ({ ...prior, [id]: !(prior[id] ?? initialIds.has(id)) }));
  }

  async function save() {
    if (submitting.current || !dirty || options.unavailable || options.loading) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await updateBookCollections({ libraryItemId, ...changes }, getToken);
      onClose();
    } catch {
      setError(t("saveFailed"));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return {
    ...options, close, toggle, save, pending, error, selectedIds, dirty,
    selectedCount: options.collections.filter(({ id }) => selectedIds.has(id)).length,
  };
}

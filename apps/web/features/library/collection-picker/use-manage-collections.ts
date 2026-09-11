"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { subscribeToCollectionMembershipDrops } from "@/features/offline/buckets/library";

export function useManageCollections(libraryItemId: string) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("library.bookInfo.collectionPicker");
  useEffect(() => subscribeToCollectionMembershipDrops((event) => {
    if (event.libraryItemId === libraryItemId) setError(t("syncFailed"));
  }), [libraryItemId, t]);
  return {
    open, error,
    show: () => { setError(null); setOpen(true); },
    close: () => setOpen(false),
  };
}

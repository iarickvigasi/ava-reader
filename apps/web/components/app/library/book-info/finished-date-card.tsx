"use client";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { emitAppToast } from "@/components/app/core/app-toast";
import {
  setBookFinishedAt,
  subscribeToFinishDateSyncFailures,
} from "@/features/offline/buckets/library";

import { ActionCard } from "./action-card";
import { CheckBoldIcon } from "./check-bold-icon";
import { useBookInfoFormatters } from "./formatters";

export function FinishedDateCard({
  finishedAt,
  libraryItemId,
}: {
  finishedAt: string | null;
  libraryItemId: string;
}) {
  const t = useTranslations("library.bookInfo.actionCards.markAsFinished");
  const { getToken } = useAuth();
  const { formatDate } = useBookInfoFormatters();
  const writing = useRef(false);
  const [pending, setPending] = useState(false);

  useEffect(
    () =>
      subscribeToFinishDateSyncFailures((event) => {
        if (event.libraryItemId === libraryItemId) {
          emitAppToast({ message: t("syncFailed"), tone: "error" });
        }
      }),
    [libraryItemId, t],
  );

  const toggleFinishedDate = async () => {
    if (writing.current) return;
    writing.current = true;
    setPending(true);
    try {
      // Save the tap time locally; the library cache drives the displayed date
      // and sync preserves this timestamp when the device reconnects.
      await setBookFinishedAt(
        libraryItemId,
        finishedAt ? null : new Date().toISOString(),
        getToken,
      );
    } catch {
      emitAppToast({ message: t("saveFailed"), tone: "error" });
    } finally {
      writing.current = false;
      setPending(false);
    }
  };

  return (
    <ActionCard
      description={t(finishedAt ? "finishedDescription" : "description")}
      disabled={pending}
      icon={CheckBoldIcon}
      onClick={toggleFinishedDate}
      title={
        finishedAt
          ? t("finishedTitle", { date: formatDate(finishedAt) })
          : t("title")
      }
    />
  );
}

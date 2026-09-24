"use client";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteBook } from "@/features/offline/buckets/library/delete-book";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import { ModalShell } from "../collection/collection-actions/modal-shell";
import { ActionCard } from "./action-card";
import { TrashBoldIcon } from "./trash-bold-icon";

export function DeleteBookCard({ libraryItemId }: { libraryItemId: string }) {
  const t = useTranslations("library.bookInfo.actionCards.deleteBook");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const online = useNetworkState();
  const router = useRouter();
  const titleId = useId();
  const busy = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function confirm() {
    if (busy.current || !online) return;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      await deleteBook(libraryItemId, getToken);
      router.replace("/app/library");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <ActionCard
        danger
        title={t("title")}
        description={t(online ? "description" : "offline")}
        icon={TrashBoldIcon}
        disabled={!online || !isLoaded || !isSignedIn || pending}
        onClick={() => {
          setError(false);
          setOpen(true);
        }}
      />
      {open && (
        <ModalShell
          maxWidth="md"
          labelledBy={titleId}
          onClose={() => {
            if (!busy.current) setOpen(false);
          }}
        >
          <div className="rounded-modal bg-surface p-6 shadow-(--shadow-card)">
            <h2 id={titleId} className="font-reader text-2xl text-title">
              {t("title")}
            </h2>
            <p className="mt-4 text-copy">{t("body")}</p>
            {error && (
              <p role="alert" className="mt-3 text-danger">
                {t("error")}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="soft"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="danger"
                disabled={pending || !online}
                onClick={() => void confirm()}
              >
                {t(pending ? "deleting" : "confirm")}
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}

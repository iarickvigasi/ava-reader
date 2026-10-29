"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ActionCard } from "@/components/app/library/book-info/action-card";
import { ExploreBoldIcon } from "@/components/app/library/book-info/explore-bold-icon";
import { Button } from "@/components/ui/button";
import { usePrivateCopyLink } from "@/features/explore/linking/use-private-copy-link";
import { PrivateLinkDialog } from "./private-link-dialog";
import { EditorialModalShell } from "../admin/editorial-modal-shell";
export function PrivateCopyLink({ libraryItemId }: { libraryItemId: string }) {
  const t = useTranslations("library.bookInfo.actionCards.catalogLink");
  const state = usePrivateCopyLink(libraryItemId);
  const { action, setAction } = state;
  return (
    <div className="space-y-3">
      {state.link && (
        <p>
          {t("descriptionLabel")}{" "}
          <Link
            className="text-plum underline"
            href={`/app/explore/books/${state.link.workId}`}
          >
            {state.link.title}
          </Link>
        </p>
      )}
      {state.pending && <p role="status">{t("pending")}</p>}
      {state.error && <p role="alert">{t("error")}</p>}
      <ActionCard
        icon={ExploreBoldIcon}
        title={t(state.link ? "changeTitle" : "title")}
        description={t("privacy")}
        onClick={() => setAction("link")}
      />
      {state.link && (
        <Button variant="ghost" onClick={() => setAction("unlink")}>
          {t("unlink")}
        </Button>
      )}
      {action === "link" && (
        <PrivateLinkDialog
          libraryItemId={libraryItemId}
          close={() => setAction(null)}
        />
      )}
      {action === "unlink" && (
        <EditorialModalShell
          title={t("unlinkTitle")}
          close={() => setAction(null)}
        >
          <p>{t("unlinkBody")}</p>
          {state.error && <p role="alert">{t("error")}</p>}
          <div className="mt-6 flex gap-3">
            <Button variant="ghost" onClick={() => setAction(null)}>
              {t("cancel")}
            </Button>
            <Button
              disabled={state.unlinkPending}
              onClick={() => void state.unlink()}
            >
              {t("unlink")}
            </Button>
          </div>
        </EditorialModalShell>
      )}
    </div>
  );
}

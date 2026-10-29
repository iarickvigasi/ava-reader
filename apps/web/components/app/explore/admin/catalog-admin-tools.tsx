"use client";
import { EditionWorkControl } from "../linking/edition-work-control";
import { CatalogPublicationControl } from "./catalog-publication-control";
import { useState } from "react";
import { ActionCard } from "@/components/app/library/book-info/action-card";
import { useTranslations } from "next-intl";
import { EditBoldIcon } from "@/components/app/library/book-info/edit-bold-icon";
import { TrashBoldIcon } from "@/components/app/library/book-info/trash-bold-icon";
import { useIsCatalogAdmin } from "@/features/explore/admin/use-is-catalog-admin";
import type { EditorialKind } from "@/features/explore/admin/types";
import { EditorialDialog } from "./editorial-dialog";

export function CatalogAdminTools({
  kind,
  id,
  workId,
}: {
  kind: EditorialKind;
  id: string;
  workId?: string;
}) {
  const t = useTranslations("explore.adminActions");
  const admin = useIsCatalogAdmin();
  const [action, setAction] = useState<"edit" | "delete" | null>(null);
  if (!admin) return null;
  return (
    <div data-catalog-actions className="space-y-4">
      <ActionCard
        icon={EditBoldIcon}
        title={
          kind === "authors"
            ? t("editAuthor")
            : kind === "editions"
              ? t("editEdition")
              : t("editBook")
        }
        description={t("editDescription")}
        onClick={() => setAction("edit")}
      />
      {(kind === "works" || workId) && (
        <CatalogPublicationControl
          key={id}
          workId={kind === "works" ? id : workId!}
          editionId={kind === "editions" ? id : undefined}
        />
      )}
      {kind !== "authors" && <EditionWorkControl kind={kind} id={id} />}
      {kind === "works" && (
        <ActionCard
          danger
          icon={TrashBoldIcon}
          title={t("deleteBook")}
          description={t("deleteDescription")}
          onClick={() => setAction("delete")}
        />
      )}
      {action && (
        <EditorialDialog
          kind={kind}
          id={id}
          remove={action === "delete"}
          close={() => setAction(null)}
        />
      )}
    </div>
  );
}

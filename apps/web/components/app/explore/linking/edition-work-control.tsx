"use client";
import { useState } from "react";
import { ActionCard } from "@/components/app/library/book-info/action-card";
import { useTranslations } from "next-intl";
import { LibraryBoldIcon } from "@/components/app/library/book-info/library-bold-icon";
import { EditionWorkDialog } from "./edition-work-dialog";
export function EditionWorkControl({
  kind,
  id,
}: {
  kind: "works" | "editions";
  id: string;
}) {
  const t = useTranslations("explore.adminActions");
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionCard
        icon={LibraryBoldIcon}
        title={t(kind === "works" ? "attachEdition" : "changeWork")}
        description={t("linkDescription")}
        onClick={() => setOpen(true)}
      />
      {open && (
        <EditionWorkDialog kind={kind} id={id} close={() => setOpen(false)} />
      )}
    </>
  );
}

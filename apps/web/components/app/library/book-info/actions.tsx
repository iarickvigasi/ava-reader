"use client";

import { useTranslations } from "next-intl";
import { ReadBookLink } from "@/components/app/core/read-book-link";
import { ReadLinkOpeningLabel } from "@/components/app/core/read-link-opening-label";
import { StackBooksIcon } from "@/components/app/shared/app-icons";
import {
  ReadListenActions,
  READ_ACTION_CLASS_NAME,
} from "@/components/app/shared/books/read-listen-actions";
import { getReaderHref } from "@/lib/app-routes";

type BookActionsProps = {
  slug: string;
  libraryItemId: string;
};

export function BookActions({ slug, libraryItemId }: BookActionsProps) {
  const t = useTranslations("library.bookInfo");
  return (
    <ReadListenActions
      readAction={
        <ReadBookLink
          href={getReaderHref(slug)}
          libraryItemId={libraryItemId}
          className={READ_ACTION_CLASS_NAME}
        >
          <ReadLinkOpeningLabel>
            <StackBooksIcon className="size-4" />
            {t("read")}
          </ReadLinkOpeningLabel>
        </ReadBookLink>
      }
    />
  );
}

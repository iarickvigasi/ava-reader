"use client";

import { useTranslations } from "next-intl";
import { ReadBookLink } from "@/components/app/core/read-book-link";
import {
  ReaderListeningIcon,
  StackBooksIcon,
} from "@/components/app/shared/app-icons";
import { Button } from "@/components/ui/button";

type BookActionsProps = {
  slug: string;
  libraryItemId: string;
};

export function BookActions({ slug, libraryItemId }: BookActionsProps) {
  const t = useTranslations("library.bookInfo");
  return (
    <div className="grid w-full max-w-120 grid-cols-2 gap-3">
      {/* Read button — when the user is offline and the book hasn't been
          saved, ReadBookLink intercepts the click and shows the
          missing-book modal instead of letting them land on an empty
          reader page. Online behaviour is unchanged. */}
      <ReadBookLink
        href={`/app/read/${slug}`}
        libraryItemId={libraryItemId}
        className="relative inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-brand-fill px-6 text-sm font-semibold uppercase tracking-[0.12em] text-white transition duration-200 hover:bg-brand-fill-strong"
      >
        <StackBooksIcon className="size-4" />
        {t("read")}
      </ReadBookLink>
      <Button
        type="button"
        variant="soft"
        className="min-h-12 w-full gap-2 rounded-[10px] px-6 text-sm font-semibold uppercase tracking-[0.12em]"
      >
        <ReaderListeningIcon className="size-4" />
        {t("listen")}
      </Button>
    </div>
  );
}

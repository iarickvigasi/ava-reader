"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { useFeaturedAdd } from "@/features/home/use-featured-add";

export function CatalogAddButton({
  className,
  entryId,
  libraryItemId,
}: {
  className?: string;
  entryId: string;
  libraryItemId?: string | null;
}) {
  const t = useTranslations("home.catalogAdd");
  const { present, pending, error, add } = useFeaturedAdd(
    entryId,
    libraryItemId,
  );
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/40 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      disabled={pending || present}
      onClick={add}
    >
      <span className="min-w-0">
        {present
          ? t("inLibrary")
          : pending
            ? t("adding")
            : error
              ? t("retry")
              : t("add")}
      </span>
    </button>
  );
}

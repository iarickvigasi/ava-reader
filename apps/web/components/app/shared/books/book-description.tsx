import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { parseBookDescription } from "@/features/library/book-description/parse-book-description";
import { DescriptionBlocks } from "./description-blocks";

type BookDescriptionProps = {
  description: null | string;
  fallbackText?: string;
  hideWhenEmpty?: boolean;
  headerActions?: React.ReactNode;
};

export function BookDescription({
  description,
  fallbackText,
  hideWhenEmpty = false,
  headerActions,
}: BookDescriptionProps) {
  const t = useTranslations("library.bookInfo");
  const fallback = useTranslations("library.bookInfo.formatters");
  const blocks = useMemo(
    () => parseBookDescription(description),
    [description],
  );

  if (hideWhenEmpty && blocks.length === 0) return null;

  return (
    <article className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="font-display text-4xl leading-none text-title md:text-5xl">
          {t("aboutThisBook")}
        </h2>
        {headerActions}
      </div>
      <div className="max-w-[65ch] space-y-4 wrap-anywhere text-start font-reader text-lg leading-[1.7] text-copy">
        {blocks.length > 0 ? (
          <DescriptionBlocks blocks={blocks} />
        ) : (
          <p>{fallbackText ?? fallback("descriptionFallback")}</p>
        )}
      </div>
    </article>
  );
}

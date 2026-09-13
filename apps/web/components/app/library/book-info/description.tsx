import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { parseBookDescription } from "@/features/library/book-description/parse-book-description";
import { DescriptionBlocks } from "./description-blocks";
import { useBookInfoFormatters } from "./formatters";

type BookDescriptionProps = {
  description: null | string;
};

export function BookDescription({ description }: BookDescriptionProps) {
  const t = useTranslations("library.bookInfo");
  const fmt = useBookInfoFormatters();
  const blocks = useMemo(
    () => parseBookDescription(description),
    [description],
  );

  return (
    <article className="min-w-0 space-y-6">
      <h2 className="font-display text-4xl leading-none text-title md:text-5xl">
        {t("aboutThisBook")}
      </h2>
      <div className="max-w-[65ch] space-y-4 wrap-anywhere text-start font-reader text-lg leading-[1.7] text-copy">
        {blocks.length > 0 ? (
          <DescriptionBlocks blocks={blocks} />
        ) : (
          <p>{fmt.descriptionFallback()}</p>
        )}
      </div>
    </article>
  );
}

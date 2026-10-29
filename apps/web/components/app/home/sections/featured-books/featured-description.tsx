import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { parseBookDescription } from "@/features/library/book-description/parse-book-description";
import { DescriptionBlocks } from "@/components/app/shared/books/description-blocks";

export function FeaturedDescription({
  description,
}: {
  description: string | null;
}) {
  const t = useTranslations("home.featuredBooks");
  const blocks = useMemo(
    () => parseBookDescription(description),
    [description],
  );
  return (
    <div className="line-clamp-4 text-base leading-7 text-copy">
      {blocks.length ? <DescriptionBlocks blocks={blocks} /> : t("fallback")}
    </div>
  );
}

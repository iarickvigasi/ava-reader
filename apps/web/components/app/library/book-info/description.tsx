import { useTranslations } from "next-intl";
import {
  buildDescriptionParagraphs,
  useBookInfoFormatters,
} from "./formatters";

type BookDescriptionProps = {
  description: null | string;
};

export function BookDescription({ description }: BookDescriptionProps) {
  const t = useTranslations("library.bookInfo");
  const fmt = useBookInfoFormatters();
  const paragraphs = buildDescriptionParagraphs(
    description,
    fmt.descriptionFallback(),
  );

  return (
    <article className="space-y-6">
      <h2 className="font-display text-4xl leading-none text-title md:text-5xl">
        {t("aboutThisBook")}
      </h2>
      <div className="space-y-5">
        {paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="max-w-3xl font-reader text-[1.12rem] leading-[1.65] text-copy"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}

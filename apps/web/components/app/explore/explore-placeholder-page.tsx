import { useTranslations } from "next-intl";
import { BookCover } from "@/components/app/shared/book-cover";
import { ExploreIcon } from "@/components/app/core/explore-icon";
import { ScreenContainer } from "@/components/ui/screen-container";
import { PageHeader } from "@/components/app/shared/page-header";

const catalogPreview = [
  {
    author: "Mary Shelley",
    blurb:
      "A moody blend of science, guilt, and responsibility that anchors the classic shelf.",
    title: "Frankenstein",
  },
  {
    author: "Homer",
    blurb:
      "Epic travel, memory, and identity from a canon text many readers revisit over time.",
    title: "The Odyssey",
  },
  {
    author: "Jane Austen",
    blurb:
      "A social comedy lens with crisp dialogue, excellent for annotation-driven reading.",
    title: "Pride and Prejudice",
  },
] as const;

export function ExplorePlaceholderPage() {
  const t = useTranslations("explore");
  return (
    <ScreenContainer className="gap-10 py-10 sm:gap-16 sm:py-16">
      <section aria-labelledby="explore-title">
        <PageHeader
          icon={ExploreIcon}
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("body")}
          titleId="explore-title"
        />
      </section>

      <section className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3">
        {catalogPreview.map((entry) => (
          <article
            key={entry.title}
            className="min-w-0 rounded-card bg-paper-strong/70 p-3"
          >
            <BookCover
              alt={`${entry.title} placeholder cover`}
              className="w-full"
              src={null}
              title={entry.title}
            />
            <div className="mt-4 space-y-2">
              <h2 className="wrap-break-word font-display text-2xl leading-tight text-title">
                {entry.title}
              </h2>
              <p className="text-[0.9rem] text-plum">{entry.author}</p>
              <p className="text-sm leading-6 text-copy">{entry.blurb}</p>
            </div>
          </article>
        ))}
      </section>
    </ScreenContainer>
  );
}

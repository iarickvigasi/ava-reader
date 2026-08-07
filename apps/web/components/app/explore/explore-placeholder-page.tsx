import { useTranslations } from "next-intl";
import { BookCover } from "@/components/app/shared/book-cover";
import { ExploreIcon } from "@/components/app/shared/app-icons";
import { ButtonLink } from "@/components/ui/button";

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 pb-10 pt-6 sm:px-6 md:pt-8 lg:px-10">
      <section className="rounded-modal bg-surface px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl space-y-5">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-muted">
            <ExploreIcon className="size-4" />
            {t("eyebrow")}
          </p>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-lg leading-8 text-copy">{t("body")}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/app" variant="soft">
              {t("backToHome")}
            </ButtonLink>
            <ButtonLink href="/app/library">{t("openLibrary")}</ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {catalogPreview.map((entry) => (
          <article
            key={entry.title}
            className="rounded-3xl bg-paper-strong/70 p-4"
          >
            <BookCover
              alt={`${entry.title} placeholder cover`}
              className="w-full"
              src={null}
              title={entry.title}
            />
            <div className="mt-4 space-y-2">
              <h2 className="font-display text-[2rem] leading-[1.02] text-title">
                {entry.title}
              </h2>
              <p className="text-[0.9rem] text-plum">{entry.author}</p>
              <p className="text-sm leading-6 text-copy">{entry.blurb}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

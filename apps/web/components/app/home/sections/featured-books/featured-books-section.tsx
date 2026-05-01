import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookCover } from "@/components/app/shared/book-cover";
import type { HomePayload } from "@/lib/api-types";
import { formatAuthors } from "@/lib/format-authors";
import { Panel, SectionHeader } from "../../shared/home-shared";
import { CatalogAddButton } from "./catalog-add-button";

type FeaturedEntry = HomePayload["featuredCatalog"]["entries"][number];

const COMPACT_VISIBLE_COUNT = 2;

export function FeaturedBooksSection({
  entries,
}: {
  entries: FeaturedEntry[];
}) {
  const t = useTranslations("home.featuredBooks");
  return (
    <section className="space-y-6">
      <SectionHeader
        label={t("explore")}
        action={
          <Link
            href="/app/explore"
            className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-6 sm:text-sm"
          >
            {t("openAll")}
          </Link>
        }
      />

      {entries.length === 0 ? (
        <Panel className="p-6 sm:p-8">
          <p className="max-w-xl text-lg leading-8 text-copy">
            {t("comingSoon")}
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:hidden">
            {entries.slice(0, COMPACT_VISIBLE_COUNT).map((entry) => (
              <FeaturedBookCompact key={entry.id} entry={entry} />
            ))}
          </div>

          <div className="hidden gap-5 md:grid md:grid-cols-2">
            {entries.map((entry) => (
              <FeaturedBookFull key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FeaturedBookCompact({ entry }: { entry: FeaturedEntry }) {
  return (
    <div className="space-y-3">
      <BookCover
        alt={`${entry.title} cover`}
        className="aspect-[0.72] w-full rounded-xs"
        src={entry.coverImageDataUrl}
        title={entry.title}
      />
      <div className="space-y-1">
        <h3 className="font-display text-lg leading-none text-title">
          {entry.title}
        </h3>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-plum">
          {formatAuthors(entry.authors)}
        </p>
      </div>
    </div>
  );
}

function FeaturedBookFull({ entry }: { entry: FeaturedEntry }) {
  const t = useTranslations("home.featuredBooks");
  return (
    <Panel className="grid gap-5 p-5 sm:grid-cols-[120px_1fr] sm:items-start sm:p-6">
      <BookCover
        alt={`${entry.title} cover`}
        className="aspect-[0.76] w-28"
        src={entry.coverImageDataUrl}
        title={entry.title}
      />
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-display text-3xl leading-none text-title">
            {entry.title}
          </h3>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-plum">
            {formatAuthors(entry.authors)}
          </p>
        </div>
        <p className="text-base leading-7 text-copy">
          {entry.description ?? t("fallback")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-line/60 bg-white/55 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-olive">
            {entry.primaryFormat}
          </span>
          <CatalogAddButton entryId={entry.id} />
        </div>
      </div>
    </Panel>
  );
}

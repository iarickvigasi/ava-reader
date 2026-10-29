import { TextActionLink } from "@/components/ui/text-action-link";
import { useTranslations } from "next-intl";
import { BookCover } from "@/components/app/shared/book-cover";
import type { HomePayload } from "@/lib/api-types";
import { resolveApiAssetUrl } from "@/lib/api";
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
          <TextActionLink href="/app/explore">{t("openAll")}</TextActionLink>
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
        className="w-full"
        src={resolveApiAssetUrl(entry.coverImageUrl)}
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
        className="w-28"
        src={resolveApiAssetUrl(entry.coverImageUrl)}
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
          <span className="rounded-full bg-white/55 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-olive">
            {entry.primaryFormat}
          </span>
          <CatalogAddButton entryId={entry.id} />
        </div>
      </div>
    </Panel>
  );
}

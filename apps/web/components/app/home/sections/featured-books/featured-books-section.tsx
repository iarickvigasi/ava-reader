import { TextActionLink } from "@/components/ui/text-action-link";
import { useTranslations } from "next-intl";
import type { HomePayload } from "@/lib/api-types";
import { Panel, SectionHeader } from "../../shared/home-shared";
import { FeaturedBookCompact } from "./featured-book-compact";
import { FeaturedBookFull } from "./featured-book-full";

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

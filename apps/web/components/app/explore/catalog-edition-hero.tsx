import { EditionSourceInformation } from "./edition-source-information";
import { useTranslations } from "next-intl";
import { useExploreReturn } from "@/features/explore/use-explore-return";
import { catalogHref } from "@/features/explore/explore-return";
import { editionHeader } from "@/features/explore/edition-header";
import type { ReadingDetails } from "@/features/explore/use-reading-details";
import type { CatalogEditionDetail } from "@/lib/catalog-types";
import { BookCoverPanel } from "@/components/app/shared/books/book-cover-panel";
import { BookTitle } from "@/components/app/shared/books/book-title";
import { BookAuthors } from "@/components/app/shared/books/book-authors";
import { TextActionLink } from "@/components/ui/text-action-link";
import { CatalogAdminReading } from "./admin/catalog-admin-reading";
import { EditionDetails } from "./edition-details";
export function CatalogEditionHero({
  edition,
  readingDetails,
}: {
  edition: CatalogEditionDetail;
  readingDetails: ReadingDetails | null;
}) {
  const t = useTranslations("explore");
  const returnHref = useExploreReturn();
  const header = editionHeader(edition);
  return (
    <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16">
      <BookCoverPanel
        title={edition.title}
        coverImageUrl={header.coverImageUrl}
      />
      <div className="space-y-7">
        <BookTitle>{edition.title}</BookTitle>
        <BookAuthors authors={header.authors} />
        <div className="flex flex-wrap items-center gap-6">
          <TextActionLink
            href={catalogHref(
              `/app/explore/books/${edition.work.id}`,
              returnHref,
            )}
            className="py-3"
          >
            {t("viewWork")}
          </TextActionLink>
          <div className="min-w-64 flex-1">
            <CatalogAdminReading
              workId={edition.work.id}
              editionId={edition.id}
              assets={edition.readingAssets}
            />
          </div>
        </div>
        <EditionDetails edition={edition} readingDetails={readingDetails} />
        <EditionSourceInformation edition={edition} />
      </div>
    </section>
  );
}

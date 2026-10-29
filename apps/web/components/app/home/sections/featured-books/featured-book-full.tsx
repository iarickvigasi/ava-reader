import { BookCover } from "@/components/app/shared/book-cover";
import type { HomePayload } from "@/lib/api-types";
import { resolveApiAssetUrl } from "@/lib/api";
import { formatAuthors } from "@/lib/format-authors";
import { FeaturedDescription } from "./featured-description";
import { Panel } from "../../shared/home-shared";
import { FeaturedBookActions } from "./featured-book-actions";
import { FeaturedEditionLink } from "./featured-edition-link";

type FeaturedEntry = HomePayload["featuredCatalog"]["entries"][number];

export function FeaturedBookFull({ entry }: { entry: FeaturedEntry }) {
  return (
    <Panel className="grid gap-5 p-5 sm:grid-cols-[120px_1fr] sm:items-start sm:p-6">
      <FeaturedEditionLink editionId={entry.editionId}>
        <BookCover
          alt={`${entry.title} cover`}
          className="w-28"
          src={resolveApiAssetUrl(entry.coverImageUrl)}
          title={entry.title}
        />
      </FeaturedEditionLink>
      <div className="flex flex-col gap-4 self-stretch">
        <div className="space-y-2">
          <h3 className="font-display text-3xl leading-none text-title">
            <FeaturedEditionLink editionId={entry.editionId}>
              {entry.title}
            </FeaturedEditionLink>
          </h3>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-plum">
            {formatAuthors(entry.authors)}
          </p>
        </div>
        <FeaturedDescription description={entry.description} />
        <div className="mt-auto">
          <FeaturedBookActions
            entryId={entry.id}
            libraryItemId={entry.libraryItemId}
          />
        </div>
      </div>
    </Panel>
  );
}

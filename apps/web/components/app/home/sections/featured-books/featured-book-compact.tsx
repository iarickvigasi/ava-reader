import { BookCover } from "@/components/app/shared/book-cover";
import type { HomePayload } from "@/lib/api-types";
import { resolveApiAssetUrl } from "@/lib/api";
import { formatAuthors } from "@/lib/format-authors";
import { FeaturedEditionLink } from "./featured-edition-link";

type FeaturedEntry = HomePayload["featuredCatalog"]["entries"][number];

export function FeaturedBookCompact({ entry }: { entry: FeaturedEntry }) {
  return (
    <div className="space-y-3">
      <FeaturedEditionLink editionId={entry.editionId}>
        <BookCover
          alt={`${entry.title} cover`}
          className="w-full"
          src={resolveApiAssetUrl(entry.coverImageUrl)}
          title={entry.title}
        />
      </FeaturedEditionLink>
      <div className="space-y-1">
        <h3 className="font-display text-lg leading-none text-title">
          <FeaturedEditionLink editionId={entry.editionId}>
            {entry.title}
          </FeaturedEditionLink>
        </h3>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-plum">
          {formatAuthors(entry.authors)}
        </p>
      </div>
    </div>
  );
}

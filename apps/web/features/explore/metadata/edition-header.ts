import type { CatalogEditionDetail } from "@/lib/catalog-types";
import { catalogCover } from "./catalog-cover";
export function editionHeader(edition: CatalogEditionDetail) {
  const editionAuthors = edition.credits.filter(
    (credit) => credit.role === "AUTHOR",
  );
  const authors = editionAuthors.length
    ? editionAuthors
    : (edition.work.credits ?? []).filter((credit) => credit.role === "AUTHOR");
  return {
    coverImageUrl: edition.coverImageUrl ?? catalogCover(edition.work),
    authors: authors.map((credit) => ({
      id: credit.author.id,
      name: credit.creditedAs ?? credit.author.displayName,
    })),
  };
}

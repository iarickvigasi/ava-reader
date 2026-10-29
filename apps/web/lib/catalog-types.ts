import type { CatalogImportEvidence } from "./catalog-import-evidence";
export type CatalogText = {
  locale: string;
  title?: string;
  description?: string | null;
  biography?: string;
};
export type CatalogCredit = {
  role: string;
  creditedAs: string | null;
  author: { id: string; displayName: string };
};
export type CatalogWork = {
  revision?: number;
  id: string;
  coverImageUrl?: string | null;
  categories?: string[];
  editions?: { coverImageUrl: string | null }[];
  originalTitle: string;
  originalLanguage: string | null;
  texts: CatalogText[];
  credits: CatalogCredit[];
  readingAssets?: CatalogReadingAsset[];
};
export type CatalogEdition = {
  id: string;
  coverImageUrl?: string | null;
  title: string;
  language: string | null;
  publisher: string | null;
  publishedYear: number | null;
  format: string;
  credits: CatalogCredit[];
  identifiers: { identifier: { scheme: string; normalizedValue: string } }[];
};
export type CatalogAuthor = {
  id: string;
  displayName: string;
  aliases: { name: string }[];
  texts: CatalogText[];
};
export type CatalogPage<T> = {
  items: T[];
  nextCursor: string | null;
  previousCursor?: string | null;
};

export type CatalogReadingAsset = {
  reviewDeferred?: boolean;
  id: string;
  checksum?: string;
  mainCatalogEntryId: string;
  rightsUrl: string;
  rightsJurisdiction: string;
  rightsStatement: string;
  edition: Pick<
    CatalogEdition,
    "id" | "title" | "language" | "format" | "publishedYear"
  >;
};

export type CatalogEditionDetail = CatalogEdition & {
  importEvidence?: CatalogImportEvidence[];
  work: Pick<
    CatalogWork,
    "id" | "originalTitle" | "credits" | "coverImageUrl" | "editions"
  >;
  readingAssets?: CatalogReadingAsset[];
};

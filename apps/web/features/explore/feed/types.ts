import type { CatalogPage, CatalogWork } from "@/lib/catalog-types";
export type FeedAnchor = { path: string; top: number };
export type LoadedCatalogPage = {
  cursor: string | null;
  before?: string;
  page: CatalogPage<CatalogWork>;
};

export type FeedRequest = {
  key: string;
  cursor: string | null;
  limit: number;
  before?: string;
};
export type FeedLoaded = {
  key: string;
  pages: LoadedCatalogPage[];
  latest: CatalogPage<CatalogWork>;
  cursor: string | null;
  before?: string;
};
export type FeedSnapshot = {
  request: FeedRequest;
  loaded: FeedLoaded;
  scroll: number;
  anchor?: FeedAnchor;
  savedAt: number;
};

export type FeedPageReconciliation = {
  loaded: FeedLoaded | null;
  request: FeedRequest | null;
  page: CatalogPage<CatalogWork> | null;
  protectedIds: readonly string[];
};
export type FeedPagingOptions = {
  key: string;
  size: { first: number; next: number } | null;
  pages: LoadedCatalogPage[];
  backward: boolean;
  loading: boolean;
  error: boolean;
};

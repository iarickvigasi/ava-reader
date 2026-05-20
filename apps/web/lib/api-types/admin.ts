import type { BookFileFormat } from "./shared";

export type AdminCatalogEntry = {
  book: {
    authors: string[];
    coverImageDataUrl: string | null;
    description: string | null;
    hasSourceFile: boolean;
    id: string;
    primaryFormat: BookFileFormat;
    title: string;
  };
  createdAt: string;
  curatorNote: string | null;
  editorialDescription: string | null;
  editorialTitle: string | null;
  featuredRank: number | null;
  id: string;
  isFeatured: boolean;
  sortOrder: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
};

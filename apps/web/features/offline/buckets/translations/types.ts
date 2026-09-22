import type { BilingualChapter } from "@/lib/api-types/bilingual";

import type { AvaReaderDB } from "../../db";

export type TranslationScope = {
  libraryItemId: string;
  chapterId: string;
  targetLang: string;
};

export type TranslationChapterRow = BilingualChapter & { fetchedAt: string };

export type TranslationSnapshot = {
  chapter: BilingualChapter | null;
  status: "loading" | "ready" | "error" | "offline";
  error: string | null;
};

export type TranslationRun = {
  controller: AbortController;
  promise: Promise<void>;
};

export type TranslationBucket = {
  scope: TranslationScope;
  db: AvaReaderDB;
  userId: string | null;
  disposed: boolean;
  snapshot: TranslationSnapshot;
  getToken: (() => Promise<string | null>) | null;
  hydrated: Promise<void>;
  pendingPersist: Promise<unknown>;
  revalidated: boolean;
  revalidationError: unknown;
  fetchRun: TranslationRun | null;
  generationRun: TranslationRun | null;
};

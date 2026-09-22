import "fake-indexeddb/auto";
import { afterEach, beforeEach, vi } from "vitest";

import type {
  BilingualChapter,
  BilingualTranslations,
} from "@/lib/api-types/bilingual";

import { __resetDbForTests, getDb } from "../../db";
import { __resetNetStateForTests } from "../../net/net-state";
import {
  awaitTranslationPersistDrain,
  clearAllTranslationBuckets,
  getTranslationBucket,
} from "./bucket";
import { applyTranslationChapter } from "./sync";

export const chapter: BilingualChapter = {
  libraryItemId: "book",
  chapterId: "chapter",
  contentRevision: "revision-1",
  translationVersion: 1,
  targetLang: "Spanish",
  translations: {},
  units: ["First sentence.", "Second sentence.", "Third sentence."].map(
    (text, index) => ({
      id: `s${index}`,
      blockId: "paragraph",
      startOffset: index * 20,
      endOffset: index * 20 + text.length,
      text,
      kind: "sentence",
    }),
  ),
};

export function translated(
  ids: string[],
  overrides: Partial<BilingualTranslations> = {},
): BilingualTranslations {
  const {
    libraryItemId,
    chapterId,
    contentRevision,
    translationVersion,
    targetLang,
  } = chapter;
  const identity = {
    libraryItemId,
    chapterId,
    contentRevision,
    translationVersion,
    targetLang,
  };
  return {
    ...identity,
    translations: Object.fromEntries(ids.map((id) => [id, `Spanish ${id}`])),
    ...overrides,
  };
}

export async function readyBucket(value: BilingualChapter = chapter) {
  const bucket = getTranslationBucket(value);
  bucket.getToken = async () => "token";
  await bucket.hydrated;
  return bucket;
}

export async function validatedBucket(value: BilingualChapter = chapter) {
  const bucket = await readyBucket(value);
  applyTranslationChapter(bucket, value);
  bucket.revalidated = true;
  return bucket;
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function translationTestLifecycle() {
  beforeEach(async () => {
    clearAllTranslationBuckets();
    __resetDbForTests();
    await getDb().delete();
    __resetDbForTests();
  });
  afterEach(async () => {
    await awaitTranslationPersistDrain();
    clearAllTranslationBuckets();
    await getDb().delete();
    __resetDbForTests();
    __resetNetStateForTests();
    vi.unstubAllGlobals();
  });
}

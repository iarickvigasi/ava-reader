import "fake-indexeddb/auto";
import { afterEach, beforeEach, vi } from "vitest";
import { __resetDbForTests } from "../../db";
import {
  __resetAiCommentsBucketsForTests,
  awaitAiCommentsPersistDrain,
  getAiCommentsBucket,
  setBucketAuth,
} from "./bucket";
import type { PendingMutation } from "./types";
let book = "";
let sequence = 0;
const api = "http://localhost:4000";
const locator = {
  chapterId: "c",
  startBlockId: "b",
  endBlockId: "b",
  startOffset: 0,
  endOffset: 4,
  contextBefore: "",
  contextAfter: "",
};
const intent = (
  kind: "generate.explain" | "generate.etymology" | "generate.translate",
  language: string,
  id: string,
): Exclude<PendingMutation, { kind: "delete" }> => ({
  kind,
  id,
  queuedAt: new Date().toISOString(),
  locator,
  payload: {
    text: "word",
    targetLang: language,
    locator: JSON.stringify(locator),
  },
});
beforeEach(() => {
  book = `language-book-${++sequence}`;
  __resetDbForTests();
  __resetAiCommentsBucketsForTests();
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(async () => {
  await awaitAiCommentsPersistDrain(book);
  __resetAiCommentsBucketsForTests();
  __resetDbForTests();
  vi.unstubAllGlobals();
});

export {
  api,
  locator,
  intent,
  book,
  getAiCommentsBucket,
  setBucketAuth,
  __resetAiCommentsBucketsForTests,
  awaitAiCommentsPersistDrain,
};

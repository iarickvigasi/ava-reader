import { it, expect } from "vitest";
import {
  chapter,
  readyBucket,
  translationTestLifecycle,
} from "./test-fixtures";
import { applyTranslationChapter } from "./sync";
translationTestLifecycle();
it("does not carry obsolete sentence IDs into a changed segmentation of the same source revision", async () => {
  const bucket = await readyBucket();
  applyTranslationChapter(bucket, {
    ...chapter,
    translations: { s0: "saved old unit" },
  });
  const changed = {
    ...chapter,
    units: [{ ...chapter.units[0], id: "new-segment" }],
  };
  applyTranslationChapter(bucket, changed);
  expect(bucket.snapshot.chapter?.translations).toEqual({});
});

import { expect, it } from "vitest";
import {
  api,
  intent,
  book,
  getAiCommentsBucket,
  __resetAiCommentsBucketsForTests,
  awaitAiCommentsPersistDrain,
} from "./language-switch-fixture";
import { enqueueGenerate } from "./mutations";
import { selectStableAiComments } from "./selectors";
it("keeps response languages and separate selection contexts distinct offline and after hydration", async () => {
  const first = intent("generate.explain", "English", "a");
  const uk = intent("generate.explain", "Ukrainian", "b");
  enqueueGenerate(book, api, first);
  enqueueGenerate(book, api, uk);
  const regenerated = {
    ...first,
    kind: "generate.explain" as const,
    id: "regenerated",
    payload: { ...first.payload, regenerationId: "regenerated" },
  };
  enqueueGenerate(book, api, regenerated);
  enqueueGenerate(book, api, { ...regenerated, id: "duplicate-replay" });
  enqueueGenerate(book, api, {
    ...first,
    id: "c",
    payload: {
      ...first.payload,
      targetLang: "English",
      context: "A different sentence.",
    },
  });
  await awaitAiCommentsPersistDrain(book);
  __resetAiCommentsBucketsForTests();
  const bucket = getAiCommentsBucket(book, api);
  await bucket.hydratedPromise;
  expect(bucket.state.pending).toHaveLength(4);
  expect(
    bucket.state.pending.some(
      (m) => m.kind !== "delete" && m.payload.regenerationId === "regenerated",
    ),
  ).toBe(true);
  expect(
    selectStableAiComments(bucket).filter(
      (row) => row.targetLang === "Ukrainian",
    ),
  ).toHaveLength(1);
});

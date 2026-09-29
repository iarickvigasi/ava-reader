import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { applyHome, readHome } from "./storage";
import { homeFixture } from "./test-fixture";
import { applyBookInfoPayload } from "../library/book-info/write-book-info";
import { applyPdfMetadata } from "../library/pdf-imports/metadata/storage";
import { book, edited } from "../library/pdf-imports/metadata/test-fixture";
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await applyBookInfoPayload(book);
});
afterEach(() => __resetDbForTests());
it("a delayed Home payload cannot revert edited Continue reading metadata", async () => {
  const payload = homeFixture();
  payload.currentEngagement = {
    ...book,
    chapterLabel: "Start",
    lastReadAt: "now",
    nextMilestone: "Next",
  };
  await applyHome(payload);
  await applyPdfMetadata(getDb(), edited);
  await applyHome(payload);
  expect((await readHome())?.currentEngagement).toMatchObject({
    title: "My title",
    authors: [],
    metadataEditVersion: 1,
  });
  await applyHome({
    ...payload,
    currentEngagement: {
      ...payload.currentEngagement,
      title: "New server title",
      metadataEditVersion: 2,
    },
  });
  expect((await readHome())?.currentEngagement?.title).toBe("New server title");
});

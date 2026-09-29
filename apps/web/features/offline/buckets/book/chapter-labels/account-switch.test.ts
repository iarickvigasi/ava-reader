import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { __resetDbForTests, getDb, setActiveUser } from "../../../db";
import { refreshDownloadedChapterLabels } from "./refresh-labels";
import { seedDownload, tocNode, updated } from "./fixture";

afterEach(async () => {
  for (const user of ["labels-alice", "labels-bob"]) {
    setActiveUser(user);
    await getDb().delete();
  }
  __resetDbForTests();
});

it("discards old-account responses without touching either user's download", async () => {
  __resetDbForTests();
  setActiveUser("labels-alice");
  await seedDownload();
  await refreshDownloadedChapterLabels({
    userId: "labels-alice",
    fetchReader: async () => {
      setActiveUser("labels-bob");
      await seedDownload();
      return updated;
    },
  });
  expect(await getDb().books.get("book")).toMatchObject({ toc: [tocNode] });
  setActiveUser("labels-alice");
  expect(await getDb().books.get("book")).toMatchObject({ toc: [tocNode] });
});

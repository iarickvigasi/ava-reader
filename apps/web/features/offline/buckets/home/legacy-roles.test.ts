import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { readHome } from "./read-home";
import type { HomePayload } from "@/lib/api-types/home";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});
it("normalizes the user in a legacy cached home response", async () => {
  const payload = {
    user: { id: "u", role: "DEVELOPER" },
    collections: { items: [] },
    stats: { volumesRead: 0 },
    mastery: {
      days: [],
      dailyGoalMinutes: 60,
      remainingMinutes: 60,
      todayMinutes: 0,
    },
  } as unknown as HomePayload;
  await getDb().home.put({
    id: "me",
    payload,
    fetchedAt: new Date().toISOString(),
  });
  expect((await readHome())?.user.roles).toEqual(["DEVELOPER"]);
});

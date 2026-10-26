import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { ReaderStartupSkeleton } from "@/components/app/reader/reader-startup-skeleton";
import { getDb } from "../../db";
import { cleanCoverTest, seedCoverItems } from "../book/covers/testing";
import { rememberCover } from "../book/warm-cover";
import {
  readReaderCover,
  readWarmReaderCover,
  clearWarmReaderCovers,
} from "./read-reader-cover";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
const identity = vi.hoisted(() => ({ owner: "reader-a" }));
vi.mock("../../db", async (original) => ({
  ...(await original<typeof import("../../db")>()),
  getActiveUserId: () => identity.owner,
}));
afterEach(async () => {
  clearWarmReaderCovers();
  vi.unstubAllGlobals();
  identity.owner = "reader-a";
  await cleanCoverTest();
});

it("opens a prepared book on its decoded cover before reader hydration", async () => {
  await seedCoverItems();
  await readReaderCover("book-a");
  rememberCover(
    "lib-1",
    {
      naturalWidth: 400,
      naturalHeight: 600,
    } as HTMLImageElement,
    "blob:loaded-cover",
  );
  vi.stubGlobal("window", { location: { pathname: "/app/read/book-a" } });
  const markup = renderToStaticMarkup(<ReaderStartupSkeleton />);
  expect(markup).toContain('src="blob:loaded-cover"');
  expect(markup).toContain("data-reader-loading-cover");
  expect(markup).not.toContain("animate-pulse");
});

it("isolates prepared metadata by account and forgets missing books on refresh", async () => {
  await seedCoverItems();
  await readReaderCover("book-a");
  identity.owner = "reader-b";
  expect(readWarmReaderCover("book-a")).toBeNull();
  identity.owner = "reader-a";
  await getDb().libraryItems.delete("lib-1");
  await readReaderCover("book-a");
  expect(readWarmReaderCover("book-a")).toBeNull();
});

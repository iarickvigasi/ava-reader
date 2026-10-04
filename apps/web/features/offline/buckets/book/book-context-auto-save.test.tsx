import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { effectHost } from "./book-context-effect-host";
import {
  bookFixture,
  closeFixture,
  flushFixture,
  resetFixture,
  saveFixture,
} from "./book-context-test-fixture";
import { BookContextProvider } from "./context";
import { getBookSaveSnapshot } from "./bucket";
import { getDb } from "../../db";

beforeEach(resetFixture);
afterEach(closeFixture);
async function render(libraryItemId = "fixture-book") {
  const node = effectHost.render(() =>
    BookContextProvider({ libraryItemId, children: null }),
  );
  await flushFixture();
  return node;
}
it("mounts an uncached reader once and keeps a failed image/save stable across status changes and fresh callbacks", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  for (let i = 0; i < 12; i++) await render();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(bookFixture.kinds).toEqual(["auto"]);
  expect(getBookSaveSnapshot("fixture-book").status).toBe("failed");
  expect(await getDb().books.get("fixture-book")).toBeUndefined();
  expect(await getDb().bookChapters.count()).toBe(0);
  expect(fetcher.mock.calls[0][0]).toContain(
    "/api/library/pdf-imports/run/resources/image",
  );
});
it("lets a real explicit save retry after failure without restarting the automatic attempt", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await render();
  await render();
  expect(await saveFixture("fixture-book", "explicit")).toMatchObject({
    kind: "failed",
  });
  for (let i = 0; i < 4; i++) await render();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(bookFixture.kinds).toEqual(["auto", "explicit"]);
});
it("starts one new automatic attempt on a genuine offline→online transition", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await render();
  await render();
  bookFixture.online = false;
  await render();
  await render();
  expect(fetcher).toHaveBeenCalledTimes(1);
  bookFixture.online = true;
  for (let i = 0; i < 5; i++) await render();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(bookFixture.kinds).toEqual(["auto", "auto"]);
});
it("qualifies a fresh cache check and one attempt for a new book/owner scope", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await render();
  await render();
  for (let i = 0; i < 3; i++) await render("second-book");
  bookFixture.ownerId = "next-owner";
  for (let i = 0; i < 3; i++) await render("second-book");
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(bookFixture.kinds).toEqual(["auto", "auto", "auto"]);
});
it("effect replay and rerender do not duplicate an in-flight/failed auto save", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await render();
  await render();
  effectHost.replayMount();
  await flushFixture();
  for (let i = 0; i < 4; i++) await render();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

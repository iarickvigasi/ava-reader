import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../db";
import { __setNetStateForTests, __resetNetStateForTests } from "../../../net/net-state";
import { hydrateBookInfo, readBookInfo, __resetLibraryBucketForTests } from "../bucket";
import { revalidateBookInfo } from "../revalidate";
import { setBookFinishedAt } from "./mutation";
import { clearFinishDateRuntime, subscribeToFinishDateSyncFailures } from "./runtime";
import { flushFinishDates } from "./sync";
import { acknowledgment, book, deferredResponse, finishedAt, priorFinishedAt, readingState, seedFinishDateFixture, token } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await seedFinishDateFixture();
});
afterEach(() => {
  clearFinishDateRuntime();
  __resetLibraryBucketForTests();
  __resetDbForTests();
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});

it("retries the original finish timestamp and persists success without changing reading state", async () => {
  const before = await readingState();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockImplementation(async () => acknowledgment(finishedAt));
  vi.stubGlobal("fetch", fetcher);
  await setBookFinishedAt(book.libraryItemId, finishedAt, token);
  __setNetStateForTests(true);
  await flushFinishDates(token);
  expect(await getDb().finishDateMutations.count()).toBe(1);
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(finishedAt);
  await flushFinishDates(token);
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [url, init] of fetcher.mock.calls) {
    expect(url).toContain(`/api/library/${book.libraryItemId}/finished`);
    expect(init).toMatchObject({ method: "PATCH", headers: { Authorization: "Bearer token" } });
    expect(JSON.parse(init.body)).toEqual({ finishedAt });
  }
  expect(await getDb().finishDateMutations.count()).toBe(0);
  clearFinishDateRuntime();
  __resetDbForTests();
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(finishedAt);
  expect(await readingState()).toEqual(before);
});

it("does not let an earlier save acknowledgment erase a newer clear", async () => {
  const first = deferredResponse();
  const second = deferredResponse();
  const fetcher = vi.fn().mockImplementationOnce(first.fetch).mockImplementationOnce(second.fetch);
  vi.stubGlobal("fetch", fetcher);
  await setBookFinishedAt(book.libraryItemId, finishedAt, token);
  __setNetStateForTests(true);
  const flushing = flushFinishDates(token);
  await first.started;
  await setBookFinishedAt(book.libraryItemId, null, token);
  first.respond(acknowledgment(finishedAt));
  await second.started;
  expect((await readBookInfo(book.slug))?.finishedAt).toBeNull();
  expect((await getDb().finishDateMutations.get(book.libraryItemId))?.finishedAt).toBeNull();
  second.respond(acknowledgment(null));
  await flushing;
  expect((await readBookInfo(book.slug))?.finishedAt).toBeNull();
  expect(await getDb().finishDateMutations.count()).toBe(0);
});

it("restores the canonical finish date and reports a permanently rejected clear", async () => {
  await hydrateBookInfo({ ...book, finishedAt: priorFinishedAt });
  const failure = vi.fn();
  subscribeToFinishDateSyncFailures(failure);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Forbidden" }, { status: 403 })));
  await setBookFinishedAt(book.libraryItemId, null, token);
  expect((await readBookInfo(book.slug))?.finishedAt).toBeNull();
  // An offline navigation can hydrate the currently displayed local value.
  // It must not replace the server baseline needed if that edit is rejected.
  await hydrateBookInfo({ ...book, finishedAt: null });
  __setNetStateForTests(true);
  await flushFinishDates(token);
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(priorFinishedAt);
  expect(await getDb().finishDateMutations.count()).toBe(0);
  await vi.waitFor(() => expect(failure).toHaveBeenCalledWith({
    libraryItemId: book.libraryItemId, reason: "Forbidden",
  }));
});

it("ignores book-info revalidation started before a finish-date edit", async () => {
  const stale = deferredResponse();
  const fetcher = vi.fn().mockImplementationOnce(stale.fetch)
    .mockImplementation(async () => acknowledgment(finishedAt));
  vi.stubGlobal("fetch", fetcher);
  const revalidating = revalidateBookInfo(book.slug, token);
  await stale.started;
  await setBookFinishedAt(book.libraryItemId, finishedAt, token);
  __setNetStateForTests(true);
  await flushFinishDates(token);
  stale.respond(Response.json({ book }));
  await revalidating;
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(finishedAt);
});

it("does not apply a former account's in-flight acknowledgment to either account", async () => {
  const pending = deferredResponse();
  vi.stubGlobal("fetch", vi.fn(pending.fetch));
  await setBookFinishedAt(book.libraryItemId, finishedAt, token);
  __setNetStateForTests(true);
  const flushing = flushFinishDates(token);
  await pending.started;
  setActiveUser("finish-date-other-user");
  await getDb().delete();
  await getDb().open();
  await seedFinishDateFixture(priorFinishedAt);
  pending.respond(acknowledgment(finishedAt));
  await flushing;
  expect((await readBookInfo(book.slug))?.finishedAt).toBe(priorFinishedAt);
  expect(await getDb().finishDateMutations.count()).toBe(0);
  await getDb().delete();
  clearFinishDateRuntime();
  __resetDbForTests();
  expect(await getDb().finishDateMutations.count()).toBe(1);
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readWithRevalidate } from "./read-with-revalidate";
import { revalidateBookInfo, revalidateCollection } from "./revalidate";

const state = vi.hoisted(() => ({
  db: {},
  generation: 0,
  hydrateBookInfo: vi.fn(),
  hydrateCollection: vi.fn(),
  hydrateFromPayload: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getPublicApiBaseUrl: () => "http://localhost:4000",
}));
vi.mock("../../db", () => ({ getDb: () => state.db }));
vi.mock("./membership/bucket", () => ({
  membershipGeneration: () => state.generation,
}));
vi.mock("./finish-date/revision", () => ({
  readFinishDateRevision: async () => null,
}));
vi.mock("./bucket", () => ({
  hydrateBookInfo: state.hydrateBookInfo,
  hydrateCollection: state.hydrateCollection,
  hydrateFromPayload: state.hydrateFromPayload,
}));

const TOKEN = async () => "token";
const SLUG = "missing-slug";
const CACHED = { slug: SLUG };
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  state.db = {};
  state.generation = 0;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([
  {
    name: "collection",
    revalidate: revalidateCollection,
    path: "/api/library/collections/missing-slug",
    payloadKey: "collection",
    hydrate: state.hydrateCollection,
  },
  {
    name: "book",
    revalidate: revalidateBookInfo,
    path: "/api/library/missing-slug",
    payloadKey: "book",
    hydrate: state.hydrateBookInfo,
  },
])("missing $name URLs", ({ revalidate, path, payloadKey, hydrate }) => {
  it("reports a confirmed 404 after an online cache miss", async () => {
    const onNotFound = vi.fn();
    const read = vi.fn().mockResolvedValue(null);

    expect(await readWithRevalidate({
      isOnline: () => true,
      read,
      revalidate: () => revalidate(SLUG, TOKEN, onNotFound),
    })).toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(`http://localhost:4000${path}`, {
      headers: { Authorization: "Bearer token" },
    });
    expect(onNotFound).toHaveBeenCalledTimes(1);
    expect(hydrate).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])("does not treat HTTP %i as a missing resource", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    const onNotFound = vi.fn();

    await revalidate(SLUG, TOKEN, onNotFound);

    expect(onNotFound).not.toHaveBeenCalled();
    expect(hydrate).not.toHaveBeenCalled();
  });

  it("does not treat a network failure as a missing resource", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const onNotFound = vi.fn();

    await expect(revalidate(SLUG, TOKEN, onNotFound)).resolves.toBeUndefined();

    expect(onNotFound).not.toHaveBeenCalled();
    expect(hydrate).not.toHaveBeenCalled();
  });

  it("does not request or report a missing resource on an offline cache miss", async () => {
    const onNotFound = vi.fn();

    expect(await readWithRevalidate({
      isOnline: () => false,
      read: async () => null,
      revalidate: () => revalidate(SLUG, TOKEN, onNotFound),
    })).toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onNotFound).not.toHaveBeenCalled();
  });

  it("returns cached content without requesting or reporting a missing resource", async () => {
    const onNotFound = vi.fn();

    expect(await readWithRevalidate({
      isOnline: () => true,
      read: async () => CACHED,
      revalidate: () => revalidate(SLUG, TOKEN, onNotFound),
    })).toEqual(CACHED);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onNotFound).not.toHaveBeenCalled();
  });

  it("ignores a 404 from the previous account", async () => {
    fetchMock.mockImplementation(async () => {
      state.db = {};
      return new Response(null, { status: 404 });
    });
    const onNotFound = vi.fn();

    await revalidate(SLUG, TOKEN, onNotFound);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onNotFound).not.toHaveBeenCalled();
  });

  it("ignores a 404 after collection membership changes", async () => {
    fetchMock.mockImplementation(async () => {
      state.generation += 1;
      return new Response(null, { status: 404 });
    });
    const onNotFound = vi.fn();

    await revalidate(SLUG, TOKEN, onNotFound);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onNotFound).not.toHaveBeenCalled();
  });

  it("does not request or report a missing resource without a token", async () => {
    const onNotFound = vi.fn();

    await revalidate(SLUG, async () => null, onNotFound);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onNotFound).not.toHaveBeenCalled();
  });

  it("still hydrates successful responses without reporting a missing resource", async () => {
    fetchMock.mockResolvedValue(Response.json({ [payloadKey]: CACHED }));
    const onNotFound = vi.fn();

    await expect(revalidate(SLUG, TOKEN, onNotFound)).resolves.toBeUndefined();

    if (payloadKey === "book") {
      expect(hydrate).toHaveBeenCalledWith(CACHED, { db: state.db, expectedFinishDateRevision: null });
    } else {
      expect(hydrate).toHaveBeenCalledWith(CACHED);
    }
    expect(onNotFound).not.toHaveBeenCalled();
  });
});

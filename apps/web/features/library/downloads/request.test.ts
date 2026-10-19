import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { downloadLibraryFormat } from "./request";

const owner = vi.hoisted(() => ({ db: {} }));
vi.mock("@/features/offline/db", () => ({ getDb: () => owner.db }));
const request = (
  getToken: () => Promise<string | null> = async () => "test-token",
  signal = new AbortController().signal,
) => downloadLibraryFormat("item/with space", "epub", getToken, signal);

beforeEach(() => {
  owner.db = {};
});
afterEach(() => vi.unstubAllGlobals());

it("requests exact owned format bytes and encodes the item path", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response("exact EPUB", {
        headers: { "Content-Type": "application/epub+zip" },
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const blob = await request();
  expect(await blob.text()).toBe("exact EPUB");
  expect(fetch.mock.calls[0][0]).toMatch(
    /\/api\/library\/item%2Fwith%20space\/formats\/epub$/,
  );
  expect(fetch.mock.calls[0][1].headers).toEqual({
    Authorization: "Bearer test-token",
  });
  expect(fetch.mock.calls[0][1].cache).toBe("no-store");
});

it("does not dispatch after auth or account ownership disappears", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(request(async () => null)).rejects.toThrow(
    "ACCOUNT_UNAVAILABLE",
  );
  await expect(
    request(async () => {
      owner.db = {};
      return "test-token";
    }),
  ).rejects.toThrow("ACCOUNT_UNAVAILABLE");
  expect(fetch).not.toHaveBeenCalled();
});

it("rejects bytes that finish after an account switch", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "Content-Type": "application/epub+zip" }),
      blob: async () => {
        owner.db = {};
        return new Blob(["old account"]);
      },
    }),
  );
  await expect(request()).rejects.toThrow("ACCOUNT_CHANGED");
});

it("rejects a completed download after its reader was closed", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "Content-Type": "application/epub+zip" }),
      blob: async () => {
        controller.abort();
        return new Blob(["late bytes"]);
      },
    }),
  );
  await expect(request(undefined, controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});

it("reports unavailable formats and rejects HTML/error bodies as books", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(
      new Response("error", { headers: { "Content-Type": "text/html" } }),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(request()).rejects.toThrow("DOWNLOAD_FAILED");
  await expect(request()).rejects.toThrow("FORMAT_INVALID");
});

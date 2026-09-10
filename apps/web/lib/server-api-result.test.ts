import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
import { fetchServerApiResult, fetchServerApiTolerant } from "./server-api";

beforeEach(() => {
  vi.unstubAllGlobals();
  authMock.mockResolvedValue({ userId: "reader", getToken: async () => "token" });
});

describe("server fallback reasons", () => {
  it("keeps connection failures separate from authentication failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await fetchServerApiResult("/api/home")).toEqual({ status: "apiUnavailable" });
    authMock.mockRejectedValue(new Error("auth unreachable"));
    expect(await fetchServerApiResult("/api/home")).toEqual({ status: "authUnavailable" });
  });

  it.each([401, 403])("identifies rejected sessions (%s)", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    expect(await fetchServerApiResult("/api/home")).toEqual({ status: "authUnavailable" });
  });

  it.each([404, 500])("does not turn HTTP %s into an offline state", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    await expect(fetchServerApiResult("/api/home")).rejects.toMatchObject({ status, name: "ServerApiError" });
  });

  it("preserves successful payloads and the existing cache contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ books: [] })));
    expect(await fetchServerApiResult("/api/home")).toEqual({ status: "ready", data: { books: [] } });
    expect(await fetchServerApiTolerant("/api/home")).toEqual({ books: [] });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await fetchServerApiTolerant("/api/home")).toBeNull();
  });
});

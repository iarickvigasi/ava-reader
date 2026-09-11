import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAnnotations } from "./load-annotations";

const source = vi.hoisted(() => ({
  endpoint: "annotations", hydrate: vi.fn(), flush: vi.fn(), version: vi.fn(), apply: vi.fn(),
}));
vi.mock("./annotation-sources", () => ({ ANNOTATION_SOURCES: { highlights: source, comments: source } }));
const options = () => ({
  kind: "highlights" as const, libraryItemId: "book/id", apiBaseUrl: "https://api.test",
  getToken: vi.fn(async () => "token"), online: true, signal: new AbortController().signal,
});

beforeEach(() => {
  vi.resetAllMocks();
  source.hydrate.mockResolvedValue(undefined);
  source.flush.mockResolvedValue(undefined);
  source.version.mockReturnValue(1);
});
afterEach(() => vi.unstubAllGlobals());

describe("annotation list loading", () => {
  it("hydrates and drains pending writes before fetching a fresh server list", async () => {
    const order: string[] = [];
    source.hydrate.mockImplementation(async () => { order.push("hydrate"); });
    source.flush.mockImplementation(async () => { order.push("flush"); });
    const fetcher = vi.fn(async () => {
      order.push("fetch");
      return new Response(JSON.stringify({ items: [{ id: "saved" }] }));
    });
    vi.stubGlobal("fetch", fetcher);
    await loadAnnotations(options());
    expect(order).toEqual(["hydrate", "flush", "fetch"]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.test/api/library/book%2Fid/annotations", expect.any(Object),
    );
    expect(source.apply).toHaveBeenCalledWith("book/id", "https://api.test", [{ id: "saved" }]);
  });

  it("cannot resurrect a deleted row or overwrite a stream changed during GET", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      source.version.mockReturnValue(2);
      return new Response(JSON.stringify({ items: [{ id: "stale" }] }));
    }));
    await loadAnnotations(options());
    expect(source.apply).not.toHaveBeenCalled();
  });

  it("serves hydrated offline state without fetching or flushing", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await loadAnnotations({ ...options(), online: false });
    expect(source.hydrate).toHaveBeenCalled();
    expect(source.flush).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("leaves cached rows intact on a failed or aborted response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));
    await expect(loadAnnotations(options())).rejects.toThrow("503");
    expect(source.apply).not.toHaveBeenCalled();
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async () => {
      controller.abort();
      return new Response(JSON.stringify({ items: [] }));
    }));
    await loadAnnotations({ ...options(), signal: controller.signal });
    expect(source.apply).not.toHaveBeenCalled();
  });
});

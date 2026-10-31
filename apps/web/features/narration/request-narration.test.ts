import { afterEach, expect, it, vi } from "vitest";
import { requestNarration } from "./request-narration";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("bounds stalled authentication without calling the API", async () => {
  const timeout = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const pending = requestNarration({
    libraryItemId: "book",
    text: "hello",
    getToken: () => new Promise(() => {}),
    signal: new AbortController().signal,
  });
  const rejected = expect(pending).rejects.toMatchObject({
    name: "TimeoutError",
  });
  timeout.abort(new DOMException("Timed out", "TimeoutError"));
  await rejected;
  expect(fetchMock).not.toHaveBeenCalled();
});

it("cancels stalled authentication on panel close", async () => {
  const controller = new AbortController();
  const pending = requestNarration({
    libraryItemId: "book",
    text: "hello",
    getToken: () => new Promise(() => {}),
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

it("sends a bearer token and only selected text, then returns audio", async () => {
  const fetchMock = vi.fn(
    async () => new Response(new Blob(["speech"], { type: "audio/mpeg" })),
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = await requestNarration({
    libraryItemId: "book",
    text: "bonjour",
    getToken: async () => "session-token",
    signal: new AbortController().signal,
  });
  expect(result.type).toBe("audio/mpeg");
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/library/book/narration"),
    expect.objectContaining({
      body: JSON.stringify({ text: "bonjour" }),
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
    }),
  );
});

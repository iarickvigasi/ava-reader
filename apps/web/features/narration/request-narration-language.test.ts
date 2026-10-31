import { afterEach, expect, it, vi } from "vitest";
import { requestNarration } from "./request-narration";
afterEach(() => vi.unstubAllGlobals());
it("transports sentence context and language as a hint", async () => {
  const fetchMock = vi.fn(
    async () => new Response(new Blob(["audio"], { type: "audio/mpeg" })),
  );
  vi.stubGlobal("fetch", fetchMock);
  await requestNarration({
    libraryItemId: "book",
    text: "生",
    context: "彼は生の魚を食べた。",
    languageHint: "ja",
    getToken: async () => "token",
    signal: new AbortController().signal,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: JSON.stringify({
        text: "生",
        context: "彼は生の魚を食べた。",
        languageHint: "ja",
      }),
    }),
  );
});
it("exposes uncertain language distinctly from network failures", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ code: "NARRATION_LANGUAGE_UNCERTAIN" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
  await expect(
    requestNarration({
      libraryItemId: "book",
      text: "chat",
      getToken: async () => "token",
      signal: new AbortController().signal,
    }),
  ).rejects.toMatchObject({ name: "NarrationLanguageUncertainError" });
});

import { afterEach, expect, it, vi } from "vitest";
import { requestNarration } from "./request-narration";
import { translationNarrationInput } from "./translation-narration-input";

afterEach(() => vi.unstubAllGlobals());
it("transports the known output language and source context while speaking only displayed text", async () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(new Blob(["speech"], { type: "audio/mpeg" })),
  );
  vi.stubGlobal("fetch", fetchMock);
  await requestNarration({
    ...translationNarrationInput({
      text: "Рюноске Акутаґава",
      language: "Ukrainian",
      source: { text: "芥川龍之介" },
    }),
    libraryItemId: "book",
    getToken: async () => "session",
    signal: new AbortController().signal,
  });
  const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as Record<
    string,
    unknown
  >;
  expect(body).toMatchObject({
    text: "Рюноске Акутаґава",
    translationLanguage: "uk",
    languageHint: "Ukrainian",
  });
  expect(body.context).toContain("Original selection: 芥川龍之介");
});

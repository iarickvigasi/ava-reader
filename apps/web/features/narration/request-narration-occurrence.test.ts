import { afterEach, expect, it, vi } from "vitest";
import { requestNarration } from "./request-narration";
afterEach(() => vi.unstubAllGlobals());
it("transports the optional exact UTF-16 context offset", async () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(new Blob(["speech"], { type: "audio/wav" })),
  );
  vi.stubGlobal("fetch", fetchMock);
  await requestNarration({
    text: "生",
    context: "生まれた子は元気に生きる",
    contextOffset: 9,
    libraryItemId: "book",
    getToken: async () => "token",
    signal: new AbortController().signal,
  });
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
    text: "生",
    contextOffset: 9,
  });
});

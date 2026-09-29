import { afterEach, expect, it, vi } from "vitest";
import { startReaderSession } from "./reader-session-client";

afterEach(() => vi.unstubAllGlobals());
it("sends the captured timezone in the live start request", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ sessionId: "session" }));
  vi.stubGlobal("fetch", fetch);
  await startReaderSession({
    getToken: async () => "token",
    isLoaded: true,
    isSignedIn: true,
    clientInstanceId: "device",
    clientSessionId: "session",
    libraryItemId: "book",
    startedAt: "2026-09-24T22:10:00Z",
    timeZone: "Europe/Belgrade",
  });
  expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toMatchObject({
    timeZone: "Europe/Belgrade",
    startedAt: "2026-09-24T22:10:00Z",
  });
});

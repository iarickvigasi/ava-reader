import { afterEach, expect, it, vi } from "vitest";
import { postCheckpoint } from "./post-checkpoint";
import { SESSION_REQUEST_TIMEOUT_MS } from "./constants";
import type { SessionRow } from "./types";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const row: SessionRow = {
  clientSessionId: "local",
  libraryItemId: "book",
  trackingVersion: 2,
  revision: 1,
  acknowledgedRevision: 0,
  startedAt: "2026-11-03T10:00:00Z",
  lastHeartbeatAt: "2026-11-03T10:00:30Z",
  endedAt: null,
  state: "open",
  timeZone: "UTC",
};

it("bounds a hanging upload and aborts its request", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(() => new Promise<Response>(() => undefined));
  vi.stubGlobal("fetch", fetch);
  const pending = postCheckpoint("token", row);
  await vi.advanceTimersByTimeAsync(SESSION_REQUEST_TIMEOUT_MS);
  expect(await pending).toEqual({ kind: "retry" });
  const options = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(options[1].signal?.aborted).toBe(true);
});

it("keeps unconfirmed revisions pending on malformed acknowledgment", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(Response.json({ sessionId: "server", revision: 0 })),
  );
  expect(await postCheckpoint("token", row)).toEqual({ kind: "retry" });
});

import { afterEach, expect, it, vi } from "vitest";
import { useMasteryHistory } from "./use-mastery-history";

vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({ getToken: async () => "test-token" }),
}));
vi.mock("./use-history-recovery", () => ({ useHistoryRecovery: vi.fn() }));
vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());
it("deduplicates simultaneous week requests and bypasses the HTTP cache", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  let resolve!: (response: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const history = useMasteryHistory("2026-09-17", 60);
  const first = history.load();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  await history.load();
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0]).toEqual([
    expect.stringContaining("/api/home/mastery?before=2026-09-17"),
    expect.objectContaining({
      cache: "no-store",
      signal: expect.any(AbortSignal),
    }),
  ]);
  resolve(
    new Response(
      JSON.stringify({ days: [], clientSessionIds: [], nextBefore: null }),
    ),
  );
  await first;
});
it("allows a retry after an offline failure", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ days: [], nextBefore: null })),
    );
  vi.stubGlobal("fetch", fetch);
  const history = useMasteryHistory("2026-09-17", 60);
  await history.load();
  expect(fetch).not.toHaveBeenCalled();
  vi.stubGlobal("navigator", { onLine: true });
  await history.load();
  expect(fetch).toHaveBeenCalledOnce();
});

import { afterEach, expect, it, vi } from "vitest";
import { beginReportRead } from "./read-client";
const search = { kind: "conversionId", reference: "pdf-1" };
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
afterEach(() => vi.useRealTimers());
it("never delivers an old account/query result after cancellation, even if fetch ignores abort", async () => {
  let resolve!: (value: Response) => void;
  const request = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const deliver = vi.fn(),
    cancel = beginReportRead(search, "user-1", deliver, request);
  cancel();
  resolve(
    Response.json({ state: "ready", ownerId: "user-1", report: "private" }),
  );
  await flush();
  expect(deliver).not.toHaveBeenCalled();
  expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
it("uses only a no-store same-origin GET and refuses a different active identity", async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ state: "ready", ownerId: "other", report: "private" }),
    );
  const deliver = vi.fn(),
    cancel = beginReportRead(search, "user-1", deliver, request);
  await flush();
  expect(request).toHaveBeenCalledWith(
    "/api/admin/pdf-reports?kind=conversionId&reference=pdf-1",
    expect.objectContaining({
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
    }),
  );
  expect(deliver).toHaveBeenCalledExactlyOnceWith({ state: "accessChanged" });
  cancel();
});
it("times out an uncooperative transport and never delivers its late response", async () => {
  vi.useFakeTimers();
  let resolve!: (value: Response) => void;
  const request = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const deliver = vi.fn(),
    cancel = beginReportRead(search, "user-1", deliver, request);
  await vi.advanceTimersByTimeAsync(12_000);
  resolve(Response.json({ state: "ready", ownerId: "user-1" }));
  await flush();
  expect(deliver).toHaveBeenCalledExactlyOnceWith({ state: "unavailable" });
  cancel();
});

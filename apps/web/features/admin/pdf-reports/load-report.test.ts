import { expect, it, vi } from "vitest";
vi.mock("@/lib/server-api", () => ({
  fetchServerApiResult: vi.fn(),
  ServerApiError: class extends Error {
    constructor(public status: number) {
      super("private error");
    }
  },
}));
import { ServerApiError } from "@/lib/server-api";
import { loadReport } from "./load-report";
const search = { kind: "conversionId", reference: "pdf-1" };
const admin = {
  status: "ready" as const,
  data: { roles: ["ADMIN"], clerkUserId: "user-1" },
};
it("does not request reports without current normal ADMIN access", async () => {
  for (const data of [
    { status: "authUnavailable" },
    { status: "apiUnavailable" },
    { status: "ready", data: { roles: ["DEVELOPER"] } },
  ]) {
    const request = vi.fn().mockResolvedValue(data);
    const result = await loadReport(search, request);
    expect(result.report).toBeUndefined();
    expect(request.mock.calls).toEqual([["/api/me"]]);
  }
});
it("shows a fresh denial without exposing previous data or private error bodies", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(admin)
    .mockResolvedValueOnce({ status: "authUnavailable" });
  expect(await loadReport(search, request)).toEqual({
    query: {
      ...search,
      view: "snapshot",
      eventCursor: undefined,
      costCursor: undefined,
    },
    state: "accessChanged",
  });
});
it("maps not found, cursor conflict, transport failure and invalid response separately", async () => {
  for (const [status, state] of [
    [404, "missing"],
    [409, "changed"],
    [403, "forbidden"],
    [413, "tooLarge"],
  ] as const) {
    const request = vi
      .fn()
      .mockResolvedValueOnce(admin)
      .mockRejectedValueOnce(new ServerApiError(status, null));
    expect((await loadReport(search, request)).state).toBe(state);
  }
  expect(
    (
      await loadReport(
        search,
        vi.fn().mockRejectedValue(new TypeError("private endpoint")),
      )
    ).state,
  ).toBe("unavailable");
  expect(
    (
      await loadReport(
        search,
        vi
          .fn()
          .mockResolvedValueOnce(admin)
          .mockResolvedValueOnce({
            status: "ready",
            data: { secret: "private" },
          }),
      )
    ).state,
  ).toBe("invalid");
});

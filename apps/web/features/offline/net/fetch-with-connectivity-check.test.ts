import { afterEach, expect, it, vi } from "vitest";
import { fetchWithConnectivityCheck } from "./fetch-with-connectivity-check";
import { checkNetworkReachability } from "./net-state";
vi.mock("./net-state", () => ({
  checkNetworkReachability: vi.fn(async () => {}),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("requests verification on a transport failure and preserves the error", async () => {
  const error = new TypeError("Failed to fetch");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
  await expect(fetchWithConnectivityCheck("/api/home")).rejects.toBe(error);
  expect(checkNetworkReachability).toHaveBeenCalledTimes(1);
});

it.each([401, 500])(
  "does not treat HTTP %s as a connectivity failure",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status })),
    );
    expect((await fetchWithConnectivityCheck("/api/home")).status).toBe(status);
    expect(checkNetworkReachability).not.toHaveBeenCalled();
  },
);

it("does not report parsing errors or intentional aborts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("invalid json")),
  );
  const response = await fetchWithConnectivityCheck("/api/home");
  await expect(response.json()).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")),
  );
  await expect(fetchWithConnectivityCheck("/api/home")).rejects.toThrow();
  expect(checkNetworkReachability).not.toHaveBeenCalled();
});

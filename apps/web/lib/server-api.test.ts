import { describe, expect, it } from "vitest";

import { ServerApiError, isNetworkError } from "./server-api";

describe("isNetworkError", () => {
  it("is false for a real HTTP error (ServerApiError)", () => {
    expect(isNetworkError(new ServerApiError(404, null))).toBe(false);
    expect(isNetworkError(new ServerApiError(500, { message: "boom" }))).toBe(
      false,
    );
    expect(isNetworkError(new ServerApiError(403, null))).toBe(false);
  });

  it("is true for a fetch TypeError (no connection)", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("is true for an undici-style error carrying a cause", () => {
    const err = new Error("fetch failed");
    (err as { cause?: unknown }).cause = new Error("ECONNREFUSED");
    expect(isNetworkError(err)).toBe(true);
  });

  it("is false for a plain Error with no cause", () => {
    expect(isNetworkError(new Error("something unexpected"))).toBe(false);
  });

  it("is false for non-error values", () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError("offline")).toBe(false);
  });
});

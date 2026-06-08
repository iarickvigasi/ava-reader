import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __setNetStateForTests } from "../net-state";

import { shouldPrime } from "./should-prime";

function stubNavigator(connection?: unknown) {
  vi.stubGlobal("navigator", { onLine: true, connection });
}

beforeEach(() => {
  vi.stubGlobal("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  __setNetStateForTests(true);
});

afterEach(() => {
  __setNetStateForTests(null);
  vi.unstubAllGlobals();
});

describe("shouldPrime", () => {
  it("primes when online and the Network Information API is absent", () => {
    stubNavigator(undefined);
    expect(shouldPrime()).toBe(true);
  });

  it("primes on a fast, non-metered connection", () => {
    stubNavigator({ effectiveType: "4g", saveData: false });
    expect(shouldPrime()).toBe(true);
  });

  it("does not prime when offline", () => {
    stubNavigator(undefined);
    __setNetStateForTests(false);
    expect(shouldPrime()).toBe(false);
  });

  it("does not prime when Save-Data is enabled", () => {
    stubNavigator({ saveData: true });
    expect(shouldPrime()).toBe(false);
  });

  it("does not prime on a slow (2g) connection", () => {
    stubNavigator({ effectiveType: "2g" });
    expect(shouldPrime()).toBe(false);
  });

  it("does not prime on a slow-2g connection", () => {
    stubNavigator({ effectiveType: "slow-2g" });
    expect(shouldPrime()).toBe(false);
  });

  it("does not prime when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    stubNavigator(undefined);
    expect(shouldPrime()).toBe(false);
  });
});

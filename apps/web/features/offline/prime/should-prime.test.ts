import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __setNetStateForTests } from "../net/net-state";

import { canPrimeMetadata, isSaveDataOn } from "./should-prime";

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

describe("canPrimeMetadata", () => {
  it("primes when online and the Network Information API is absent", () => {
    stubNavigator(undefined);
    expect(canPrimeMetadata()).toBe(true);
  });

  it("primes on a fast connection", () => {
    stubNavigator({ effectiveType: "4g", saveData: false });
    expect(canPrimeMetadata()).toBe(true);
  });

  it("primes metadata even on Save-Data (only the content tier gates on it)", () => {
    stubNavigator({ saveData: true });
    expect(canPrimeMetadata()).toBe(true);
  });

  it("does not prime when offline", () => {
    stubNavigator(undefined);
    __setNetStateForTests(false);
    expect(canPrimeMetadata()).toBe(false);
  });

  it("does not prime on a slow (2g) connection", () => {
    stubNavigator({ effectiveType: "2g" });
    expect(canPrimeMetadata()).toBe(false);
  });

  it("does not prime on a slow-2g connection", () => {
    stubNavigator({ effectiveType: "slow-2g" });
    expect(canPrimeMetadata()).toBe(false);
  });

  it("does not prime when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    stubNavigator(undefined);
    expect(canPrimeMetadata()).toBe(false);
  });
});

describe("isSaveDataOn", () => {
  it("is true when the connection reports Save-Data", () => {
    stubNavigator({ saveData: true });
    expect(isSaveDataOn()).toBe(true);
  });

  it("is false when Save-Data is off", () => {
    stubNavigator({ effectiveType: "4g", saveData: false });
    expect(isSaveDataOn()).toBe(false);
  });

  it("is false when the Network Information API is absent", () => {
    stubNavigator(undefined);
    expect(isSaveDataOn()).toBe(false);
  });
});

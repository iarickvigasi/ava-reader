import { afterEach, describe, expect, it } from "vitest";

import {
  __resetBookBucketForTests,
  clearInFlight,
  hasInFlightSaves,
  isCurrentInFlight,
  registerInFlight,
} from "./bucket";

afterEach(() => {
  __resetBookBucketForTests();
});

describe("in-flight ownership fence", () => {
  it("a superseded controller neither owns the slot nor clears it", () => {
    const first = new AbortController();
    const second = new AbortController();

    registerInFlight("lib-1", first);
    registerInFlight("lib-1", second); // supersedes `first` (and aborts it)

    expect(first.signal.aborted).toBe(true);
    expect(isCurrentInFlight("lib-1", first)).toBe(false);
    expect(isCurrentInFlight("lib-1", second)).toBe(true);

    // `first`'s teardown runs late; it must NOT evict `second`'s registration.
    clearInFlight("lib-1", first);
    expect(hasInFlightSaves()).toBe(true);

    // The real owner clearing does drop the slot.
    clearInFlight("lib-1", second);
    expect(hasInFlightSaves()).toBe(false);
  });
});

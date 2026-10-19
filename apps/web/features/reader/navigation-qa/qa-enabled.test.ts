import { expect, it } from "vitest";
import { navigationQaEnabled } from "./qa-enabled";
it.each(["localhost", "127.0.0.1", "::1", "[::1]"])(
  "requires both build gates even on %s",
  (host) => {
    expect(navigationQaEnabled(host, "1", true)).toBe(true);
    expect(navigationQaEnabled(host, "1", false)).toBe(false);
    expect(navigationQaEnabled(host, undefined, true)).toBe(false);
    expect(navigationQaEnabled(host, "0", false)).toBe(false);
  },
);
it.each(["ava.example", "192.168.1.50", "localhost.attacker.example"])(
  "cannot enable controls on %s",
  (host) => {
    expect(navigationQaEnabled(host, "1", true)).toBe(false);
  },
);

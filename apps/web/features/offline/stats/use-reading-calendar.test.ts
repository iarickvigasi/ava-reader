import { afterEach, expect, it, vi } from "vitest";
import { useReadingCalendar } from "./use-reading-calendar";

const state = vi.hoisted(() => ({ zone: "Europe/Belgrade" }));
vi.mock("./device-time-zone", () => ({ deviceTimeZone: () => state.zone }));
vi.mock("react", () => ({
  useSyncExternalStore: (
    subscribe: (listener: () => void) => () => void,
    snapshot: () => string,
    serverSnapshot: () => null,
  ) => ({ subscribe, snapshot, serverSnapshot }),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("advances a mounted calendar after midnight and rechecks timezone on resume", () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-09-24T21:59:59Z"));
  state.zone = "Europe/Belgrade";
  const document = new EventTarget();
  const window = Object.assign(new EventTarget(), {
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  const calendar = useReadingCalendar() as unknown as {
    subscribe: (listener: () => void) => () => void;
    snapshot: () => string;
    serverSnapshot: () => null;
  };
  expect(calendar.serverSnapshot()).toBeNull();
  expect(calendar.snapshot()).toBe("Europe/Belgrade|2026-09-24");
  const changes: string[] = [];
  const unsubscribe = calendar.subscribe(() =>
    changes.push(calendar.snapshot()),
  );
  vi.advanceTimersByTime(30_000);
  expect(changes.at(-1)).toBe("Europe/Belgrade|2026-09-25");
  state.zone = "America/Los_Angeles";
  document.dispatchEvent(new Event("visibilitychange"));
  expect(changes.at(-1)).toBe("America/Los_Angeles|2026-09-24");
  unsubscribe();
  vi.advanceTimersByTime(30_000);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(changes).toHaveLength(2);
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  __resetNetStateForTests,
  checkNetworkReachability,
} from "@/features/offline/net/net-state";
import { useHeaderChip } from "@/features/offline/status/use-header-chip";
import { OfflineIndicator } from "./offline-indicator";
import { SlowConnectionIndicator } from "./slow-connection-indicator";

const harness = vi.hoisted(() => ({ slow: false, chip: { kind: "none" } }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
  useState: (initial: () => unknown) => [
    initial(),
    (value: typeof harness.chip) => {
      harness.chip = value;
    },
  ],
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void) => effect(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./offline-modal-context", () => ({
  useOfflineModal: () => ({ open: vi.fn() }),
}));
vi.mock("@/features/offline/net/use-slow-state", () => ({
  useSlowState: () => harness.slow,
}));
beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  harness.slow = false;
  __resetNetStateForTests();
});
afterEach(() => {
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});
it("hides Offline in both the indicator and header slot during an API outage", async () => {
  await checkNetworkReachability();
  expect(OfflineIndicator({})).toBeNull();
  useHeaderChip();
  expect(harness.chip.kind).toBe("none");
  harness.slow = true;
  useHeaderChip();
  expect(harness.chip.kind).toBe("slow");
  expect(SlowConnectionIndicator({})).not.toBeNull();
});
it("shows Offline only while the browser is offline, even before API recovery", async () => {
  await checkNetworkReachability();
  vi.stubGlobal("navigator", { onLine: false });
  window.dispatchEvent(new Event("offline"));
  expect(OfflineIndicator({})).not.toBeNull();
  useHeaderChip();
  expect(harness.chip.kind).toBe("offline");
  vi.stubGlobal("navigator", { onLine: true });
  window.dispatchEvent(new Event("online"));
  expect(OfflineIndicator({})).toBeNull();
  useHeaderChip();
  expect(harness.chip.kind).toBe("none");
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { effectHost } from "../buckets/book/book-context-effect-host";
import type { LibraryView } from "../buckets/library";
import { BackgroundPrimer } from "./primer";
import { deferred } from "@/features/reader/canonical/resource-recovery-fixture";
const h = vi.hoisted(() => ({
  online: true,
  view: null as LibraryView | null,
  tasks: [] as (() => void)[],
  prime: vi.fn(),
  token: vi.fn(async () => "authored-token"),
  t: (key: string) => key,
}));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({
    getToken: h.token,
    isLoaded: true,
    isSignedIn: true,
  }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => h.t }));
vi.mock("../buckets/library", () => ({ useLibraryView: () => h.view }));
vi.mock("../net/use-network-state", () => ({
  useNetworkState: () => h.online,
}));
vi.mock("../net/use-sync-triggers", () => ({ useSyncTriggers: vi.fn() }));
vi.mock("../db", () => ({ getDb: () => ({}) }));
vi.mock("./prime-all", () => ({
  primeAllCaches: (...args: unknown[]) => h.prime(...args),
}));
vi.mock("./schedule-idle", () => ({
  scheduleIdle: (run: () => void) => h.tasks.push(run),
}));
function view(ready: boolean): LibraryView {
  return {
    summary: { booksCount: 1, collectionsCount: 1 },
    collections: [
      {
        id: "shelf",
        slug: "shelf",
        name: "Imported",
        kind: "SMART",
        smartKey: "imported-library",
        description: null,
        itemCount: 1,
        unreadCount: 1,
        books: [
          {
            libraryItemId: "requested-pdf",
            slug: "pdf",
            title: "Fixture",
            authors: [],
            coverImageUrl: null,
            completionPercent: 0,
            primaryFormat: "PDF",
            lastReadAt: null,
            savedOffline: false,
            offlineRequested: true,
            pdfImport: {
              operationId: "fixture-op",
              libraryItemId: "requested-pdf",
              status: ready ? "READY" : "WAITING",
              stage: "VALIDATION",
              generation: 1,
              updatedAt: "2026-10-13T00:00:00Z",
              sourceArtifactId: "fixture-source",
              finalContentId: ready ? "fixed-content" : null,
              failureId: null,
              investigationRecorded: true,
              progress: null,
            },
          },
        ],
      },
    ],
  };
}
function render() {
  effectHost.render(() => BackgroundPrimer());
  effectHost.flush();
}
async function drain() {
  const tasks = h.tasks.splice(0);
  for (const run of tasks) run();
  await Promise.resolve();
  await Promise.resolve();
}
beforeEach(() => {
  effectHost.reset();
  vi.clearAllMocks();
  h.online = true;
  h.view = view(false);
  h.tasks = [];
  h.prime.mockResolvedValue({ contentConsentNeeded: false });
});
afterEach(async () => {
  effectHost.unmount();
  await drain();
});
it("re-kicks background preparation when a requested PDF becomes readable after the prior pass", async () => {
  render();
  await drain();
  expect(h.prime).toHaveBeenCalledTimes(1);
  h.view = view(true);
  render();
  await drain();
  expect(h.prime).toHaveBeenCalledTimes(2);
  h.view = view(true);
  render();
  await drain();
  expect(h.prime).toHaveBeenCalledTimes(2);
});
it("does not lose the readiness edge while a pass is active and drops a pending kick on disposal", async () => {
  const active = deferred<{ contentConsentNeeded: boolean }>();
  h.prime.mockReturnValueOnce(active.promise);
  render();
  await drain();
  h.view = view(true);
  render();
  await drain();
  expect(h.prime).toHaveBeenCalledTimes(1);
  active.resolve({ contentConsentNeeded: false });
  await Promise.resolve();
  await drain();
  expect(h.prime).toHaveBeenCalledTimes(2);
  const later = deferred<{ contentConsentNeeded: boolean }>();
  h.prime.mockReturnValueOnce(later.promise);
  h.online = false;
  render();
  h.online = true;
  render();
  await drain();
  h.view = view(false);
  render();
  h.view = view(true);
  render();
  await drain();
  effectHost.unmount();
  later.resolve({ contentConsentNeeded: false });
  await Promise.resolve();
  await drain();
  expect(h.prime).toHaveBeenCalledTimes(3);
});

it("refuses an old scheduled pass after its account-token closure changes", async () => {
  render();
  const oldToken = h.token;
  h.token = vi.fn(async () => "authored-current-token");
  render();
  await drain();
  expect(h.prime).not.toHaveBeenCalled();
  h.view = view(true);
  render();
  await drain();
  expect(h.prime).toHaveBeenCalledTimes(1);
  expect(h.prime.mock.calls[0][0].getToken).toBe(h.token);
  expect(h.prime.mock.calls[0][0].getToken).not.toBe(oldToken);
});

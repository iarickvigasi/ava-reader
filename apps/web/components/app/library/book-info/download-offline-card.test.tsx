import { beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { PdfImportSummary } from "@/lib/api-types/pdf-import";
import { effectHost } from "@/features/offline/buckets/book/book-context-effect-host";
import { DownloadOfflineCard } from "./download-offline-card";
import type { ActionCard } from "./action-card";

// Reuse the existing Node hook-turn host; real DOM/browser timing is separate.
const h = vi.hoisted(() => ({
  online: true,
  requested: false,
  state: "absent" as "absent" | "explicit",
  status: "idle",
  save: vi.fn(),
  refresh: vi.fn(),
  token: vi.fn(async () => "authored-token"),
  intent: vi.fn(),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({ getToken: h.token }),
}));
vi.mock("@/features/offline/net/use-network-state", () => ({
  useNetworkState: () => h.online,
}));
vi.mock("@/features/offline/buckets/book", () => ({
  useBookSaveStatus: () => ({
    status: h.status,
    currentChapters: 0,
    totalChapters: 0,
  }),
  useBookOfflineState: () => ({
    state: h.state,
    fromAutoSave: false,
    offlineRequested: h.requested,
    refresh: h.refresh,
  }),
  useSaveBook: () => ({ save: h.save, remove: vi.fn(), cancel: vi.fn() }),
}));
vi.mock("@/features/offline/buckets/library", () => ({
  setBookOfflineIntent: (...args: unknown[]) => h.intent(...args),
  promoteBookOffline: vi.fn(),
  releaseBookOffline: vi.fn(),
}));
function pdf(
  status: PdfImportSummary["status"],
  ready = status === "READY",
): PdfImportSummary {
  return {
    status,
    finalContentId: ready ? "authored-content" : null,
    operationId: "authored-op",
    libraryItemId: "authored-pdf",
    stage: "VALIDATION",
    generation: 1,
    updatedAt: "2026-10-13T00:00:00Z",
    sourceArtifactId: "authored-source",
    failureId: status === "FAILED" ? "authored-failure" : null,
    investigationRecorded: true,
    progress: null,
  };
}
function render(status?: PdfImportSummary) {
  const element = effectHost.render(() =>
    DownloadOfflineCard({ libraryItemId: "authored-pdf", pdfImport: status }),
  );
  effectHost.flush();
  return element.props as ComponentProps<typeof ActionCard>;
}
beforeEach(() => {
  effectHost.reset();
  vi.clearAllMocks();
  h.online = true;
  h.requested = false;
  h.state = "absent";
  h.status = "idle";
  h.intent.mockImplementation(async (_id: string, requested: boolean) => {
    h.requested = requested;
    return true;
  });
  h.save.mockImplementation(async () => {
    h.state = "explicit";
    h.status = "saved";
    return { kind: "saved" };
  });
});
it("disables native EPUB saving until ready, then starts a retained request", () => {
  const epubImport = {
    status: "PROCESSING" as const,
    runId: "run",
    updatedAt: "2026-10-15T10:00:00Z",
    finalContentId: null,
  };
  const renderNative = (ready: boolean) => {
    const element = effectHost.render(() =>
      DownloadOfflineCard({
        libraryItemId: "native",
        epubImport: ready
          ? { ...epubImport, status: "READY", finalContentId: "content" }
          : epubImport,
      }),
    );
    effectHost.flush();
    return element.props as ComponentProps<typeof ActionCard>;
  };
  expect(renderNative(false).disabled).toBe(true);
  h.requested = true;
  renderNative(false);
  expect(h.save).not.toHaveBeenCalled();
  renderNative(true);
  expect(h.save).toHaveBeenCalledTimes(1);
});
it.each(["QUEUED", "RUNNING", "WAITING", "FAILED", "STOPPED"] as const)(
  "retains the explicit request without starting or retrying a %s PDF download",
  async (status) => {
    await render(pdf(status)).onClick!();
    render(pdf(status));
    effectHost.replayMount();
    render(pdf(status));
    h.status = "failed";
    render(pdf(status));
    h.online = false;
    render(pdf(status));
    h.online = true;
    render(pdf(status));
    expect(h.intent).toHaveBeenCalledWith("authored-pdf", true, h.token);
    expect(h.requested).toBe(true);
    expect(h.state).toBe("absent");
    expect(h.save).not.toHaveBeenCalled();
  },
);
it("starts the same queued request when Ready arrives, and waits for reconnect if needed", async () => {
  await render(pdf("WAITING")).onClick!();
  render(pdf("WAITING"));
  h.online = false;
  render(pdf("READY"));
  expect(h.save).not.toHaveBeenCalled();
  h.online = true;
  render(pdf("READY"));
  await Promise.resolve();
  render(pdf("READY"));
  expect(h.save).toHaveBeenCalledTimes(1);
  expect(h.save).toHaveBeenCalledWith("explicit");
  expect(h.requested).toBe(true);
  expect(h.state).toBe("explicit");
});
it("does not treat a nominal Ready status without accepted content as readable", async () => {
  await render(pdf("READY", false)).onClick!();
  render(pdf("READY", false));
  expect(h.requested).toBe(true);
  expect(h.save).not.toHaveBeenCalled();
});
it("keeps ordinary book queuing behavior and allows cancellation before a PDF becomes ready", async () => {
  await render(pdf("WAITING")).onClick!();
  await render(pdf("WAITING")).onClick!();
  expect(h.requested).toBe(false);
  render(pdf("READY"));
  expect(h.save).not.toHaveBeenCalled();
  await render().onClick!();
  render();
  await Promise.resolve();
  expect(h.save).toHaveBeenCalledTimes(1);
});

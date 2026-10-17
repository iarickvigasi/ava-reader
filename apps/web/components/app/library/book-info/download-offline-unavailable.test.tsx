import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { PdfImportSummary } from "@/lib/api-types/pdf-import";
import { DownloadOfflineCard } from "./download-offline-card";

const h = vi.hoisted(() => ({ requested: false }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({ getToken: vi.fn() }),
}));
vi.mock("@/features/offline/net/use-network-state", () => ({
  useNetworkState: () => true,
}));
vi.mock("@/features/offline/buckets/book", () => ({
  useBookSaveStatus: () => ({
    status: "idle",
    currentChapters: 0,
    totalChapters: 0,
  }),
  useBookOfflineState: () => ({
    state: "absent",
    fromAutoSave: false,
    offlineRequested: h.requested,
    refresh: vi.fn(),
  }),
  useSaveBook: () => ({ save: vi.fn(), remove: vi.fn(), cancel: vi.fn() }),
}));
vi.mock("@/features/offline/buckets/library", () => ({
  setBookOfflineIntent: vi.fn(),
  promoteBookOffline: vi.fn(),
  releaseBookOffline: vi.fn(),
}));
function render(status: PdfImportSummary["status"]) {
  const pdfImport: PdfImportSummary = {
    status,
    finalContentId: status === "READY" ? "accepted-content" : null,
    operationId: "op",
    libraryItemId: "item",
    stage: "VALIDATION",
    generation: 1,
    updatedAt: "2026-10-17T00:00:00Z",
    sourceArtifactId: "source",
    failureId: null,
    investigationRecorded: true,
    progress: null,
  };
  return renderToStaticMarkup(
    <DownloadOfflineCard libraryItemId="item" pdfImport={pdfImport} />,
  );
}
beforeEach(() => {
  h.requested = false;
});
it.each(["FAILED", "STOPPED"] as const)(
  "disables idle offline saving for a %s PDF",
  (status) => {
    const html = render(status);
    expect(html).toContain('disabled=""');
    expect(html).toContain("idle.unavailableDescription");
    expect(html).not.toContain("idle.description");
  },
);
it.each(["FAILED", "STOPPED"] as const)(
  "keeps an earlier %s request cancellable",
  (status) => {
    h.requested = true;
    const html = render(status);
    expect(html).not.toContain('disabled=""');
    expect(html).toContain("pending.unavailableDescription");
  },
);
it.each(["WAITING", "READY"] as const)(
  "preserves %s PDF queuing/readable behavior",
  (status) => {
    const html = render(status);
    expect(html).not.toContain('disabled=""');
    expect(html).toContain("idle.description");
  },
);

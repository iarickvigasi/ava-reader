import type { ReaderPanel } from "@/components/app/core/reader-ui-context";

export function readerPanelId(panel: ReaderPanel) {
  return `reader-panel-${panel}`;
}

export function readerPanelControl(panel: ReaderPanel) {
  return panel === "download"
    ? "[data-reader-download-control]"
    : `[data-reader-panel-control="${panel}"], [data-reader-panel-fallback~="${panel}"]`;
}

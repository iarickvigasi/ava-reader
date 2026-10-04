import type { ReaderLocator } from "@/lib/api-types";

export function focusReaderPassage(
  locator: ReaderLocator,
  current: () => boolean = () => true,
) {
  const frame = document.querySelector<HTMLElement>("[data-reader-navigation]");
  requestAnimationFrame(() => {
    if (!current() || !frame?.isConnected) return;
    const candidates = [
      ...frame.querySelectorAll<HTMLElement>("[data-reader-block='true']"),
    ].filter((element) => {
      if (element.closest("[inert], [aria-hidden='true']")) return false;
      const rect = element.getBoundingClientRect();
      return (
        element.dataset.chapterId === locator.chapterId &&
        (!locator.blockId || element.dataset.blockId === locator.blockId) &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight
      );
    });
    const element =
      candidates.find((candidate) => {
        const { readerStartOffset: start, readerEndOffset: end } =
          candidate.dataset;
        return (
          start === undefined ||
          end === undefined ||
          (Number(start) <= locator.textOffset &&
            Number(end) > locator.textOffset)
        );
      }) ??
      candidates.find(
        (candidate) =>
          Number(candidate.dataset.readerEndOffset) === locator.textOffset,
      );
    if (element) {
      element.tabIndex = -1;
      element.focus({ preventScroll: true });
    }
  });
}

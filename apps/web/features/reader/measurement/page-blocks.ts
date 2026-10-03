// A table wrapper is a valid explicit offset-zero target, but progress must
// locate its visible cell, not repeatedly resume at the whole table's start.
export function pageLocatorBlocks(article: HTMLElement) {
  return Array.from(
    article.querySelectorAll<HTMLElement>("[data-reader-block='true']"),
  ).filter(
    (block) =>
      !(
        block.dataset.readerBlockKind === "image" &&
        block.querySelector("[data-reader-block='true']")
      ),
  );
}

// Container wrappers retain explicit targets; progress uses visible leaves.
export function pageLocatorBlocks(article: HTMLElement) {
  return Array.from(
    article.querySelectorAll<HTMLElement>("[data-reader-block='true']"),
  ).filter(
    (block) =>
      !(
        ["image", "list"].includes(block.dataset.readerBlockKind ?? "") &&
        block.querySelector("[data-reader-block='true']")
      ),
  );
}

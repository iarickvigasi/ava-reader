import type {
  CanonicalBookV2,
  ListGroup,
} from "@/lib/api-types/canonical-reader.generated";

// Accepted packages are immutable. Reuse one index while projecting cold
// windows; repeated note/style lookups must not scan the whole book per span.
const indexes = new WeakMap<CanonicalBookV2, ReturnType<typeof buildIndex>>();
function buildIndex(book: CanonicalBookV2) {
  const childLists = new Map<string, ListGroup[]>();
  for (const list of book.lists) {
    if (!list.parent_item_id) continue;
    const siblings = childLists.get(list.parent_item_id) ?? [];
    siblings.push(list);
    childLists.set(list.parent_item_id, siblings);
  }
  return {
    blocks: new Map(book.blocks.map((block) => [block.id, block])),
    cells: new Map(
      book.blocks.flatMap((block) =>
        block.kind === "table"
          ? block.cells.map((cell) => [cell.id, cell] as const)
          : [],
      ),
    ),
    chapters: new Map(book.chapters.map((chapter) => [chapter.id, chapter])),
    styles: new Map(book.styles.map((style) => [style.id, style])),
    resources: new Map(
      book.resources.map((resource) => [resource.id, resource]),
    ),
    addresses: new Map(
      book.addresses.map((address) => [address.fragment, address]),
    ),
    itemLists: new Map(
      book.lists.flatMap((list) =>
        list.item_ids.map((id) => [id, list] as const),
      ),
    ),
    childLists,
  };
}
export function indexCanonicalBook(book: CanonicalBookV2) {
  const prior = indexes.get(book);
  if (prior) return prior;
  const index = buildIndex(book);
  indexes.set(book, index);
  return index;
}

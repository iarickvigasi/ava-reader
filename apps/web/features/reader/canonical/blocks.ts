import type { CanonicalBookV2 } from "@/lib/api-types/canonical-reader.generated";
import type { ReaderBlock } from "@/lib/api-types/reader-content";
import { canonicalInlines, canonicalTarget } from "./inlines";
import { indexCanonicalBook } from "./index-book";

export function canonicalBlock(
  book: CanonicalBookV2,
  id: string,
  urls: Record<string, string>,
): ReaderBlock {
  const index = indexCanonicalBook(book);
  const block = index.blocks.get(id);
  if (!block) throw new Error("Missing canonical block");
  const presentation = block.style_id
    ? index.styles.get(block.style_id)
    : undefined;
  const base = { id, canonical: true, anchorId: id, presentation, text: "" };
  if (block.kind === "figure") {
    const resource = index.resources.get(block.resource_id);
    const src = urls[block.resource_id];
    if (!resource || !src) throw new Error("Missing canonical resource");
    return {
      ...base,
      kind: "image",
      src,
      alt: block.alt,
      captionId: block.caption_id,
      creditId: block.credit_id,
      width: resource.width,
      height: resource.height,
    };
  }
  if (block.kind === "separator") return { ...base, kind: "separator" };
  if (block.kind === "table")
    return {
      ...base,
      kind: "table",
      captionId: block.caption_id,
      cells: block.cells.map((cell) => ({
        id: cell.id,
        canonical: true,
        text: cell.content.text,
        canonicalText: cell.content,
        presentation: cell.style_id
          ? index.styles.get(cell.style_id)
          : undefined,
        rowSpan: cell.row_span ?? 1,
        columnSpan: cell.column_span ?? 1,
        row: cell.row,
        column: cell.column,
        headerAxis: cell.header_axis,
        headerIds: cell.header_ids ?? [],
        inlines: canonicalInlines(book, cell.content),
      })),
    };
  const text = {
    ...base,
    text: block.content.text,
    canonicalText: block.content,
    inlines: canonicalInlines(book, block.content),
  };
  if (block.kind === "heading")
    return { ...text, kind: "heading", level: block.level };
  if (block.kind === "note") {
    const returns = block.callout_ids.map((callout) => {
      const address = index.addresses.get(callout);
      if (!address) throw new Error("Missing note return");
      return { label: callout, target: canonicalTarget(book, address.target) };
    });
    return { ...text, kind: "note", noteRole: block.note_role, returns };
  }
  return {
    ...text,
    kind:
      block.kind === "quote"
        ? "blockquote"
        : block.kind === "list_item"
          ? "paragraph"
          : block.kind,
  };
}

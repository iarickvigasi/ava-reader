import type { ReaderInline } from "@/lib/api-types/reader-content";

type TextInline = Extract<ReaderInline, { kind: "text" }>;
type InlineGroup =
  | { kind: "text"; sourceIndex: number; inlines: TextInline[] }
  | {
      kind: "image";
      sourceIndex: number;
      inline: Extract<ReaderInline, { kind: "image" }>;
    };

// Style boundaries split text runs, but one semantic occurrence owns one link.
export function groupInlineLinkOccurrences(
  inlines: readonly ReaderInline[],
): InlineGroup[] {
  const groups: InlineGroup[] = [];
  for (const [sourceIndex, inline] of inlines.entries()) {
    if (inline.kind === "image") {
      groups.push({ kind: "image", sourceIndex, inline });
      continue;
    }
    const previous = groups.at(-1);
    if (
      previous?.kind === "text" &&
      sameLinkOccurrence(previous.inlines[0], inline)
    ) {
      previous.inlines.push(inline);
    } else {
      groups.push({ kind: "text", sourceIndex, inlines: [inline] });
    }
  }
  return groups;
}

function sameLinkOccurrence(left: TextInline, right: TextInline) {
  return (
    !!left.spanId?.trim() &&
    left.spanId === right.spanId &&
    !!(left.target || left.href) &&
    left.sourceOffset === right.sourceOffset &&
    left.href === right.href &&
    !!left.target === !!right.target &&
    left.target?.chapterId === right.target?.chapterId &&
    left.target?.blockId === right.target?.blockId &&
    left.target?.textOffset === right.target?.textOffset &&
    left.target?.note === right.target?.note
  );
}

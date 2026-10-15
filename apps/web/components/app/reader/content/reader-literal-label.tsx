import type { ReaderInline } from "@/lib/api-types/reader-content";
import { groupInlineLinkOccurrences } from "@/features/reader/group-inline-link-occurrences";
import { splitLiteralPrefix } from "@/features/reader/split-literal-prefix";
import { ReaderInlineContent } from "./reader-inline-content";
import { ReaderContentLink } from "./reader-content-link";

type Label = { end: number; columnEm: number };
export function ReaderLiteralLabel({
  inlines,
  label,
}: {
  inlines: ReaderInline[];
  label: Label;
}) {
  const first = groupInlineLinkOccurrences(inlines)[0];
  const linked =
    first?.kind === "text" &&
    (first.inlines[0].href || first.inlines[0].target);
  const covers =
    linked && first.inlines.reduce((n, i) => n + i.text.length, 0) > label.end;
  if (covers && first.kind === "text") {
    // One link encloses both columns; strip only the duplicate projection wrappers.
    const content = first.inlines.map((i) => ({
      ...i,
      href: undefined,
      target: undefined,
    }));
    return (
      <>
        <ReaderContentLink link={first.inlines[0]}>
          <LabelContent inlines={content} label={label} />
        </ReaderContentLink>
        <ReaderInlineContent inlines={inlines.slice(first.inlines.length)} />
      </>
    );
  }
  return <LabelContent inlines={inlines} label={label} />;
}

function LabelContent({
  inlines,
  label,
}: {
  inlines: ReaderInline[];
  label: Label;
}) {
  const { prefix, body } = splitLiteralPrefix(inlines, label.end);
  return (
    <>
      <span
        data-reader-literal-label
        style={{
          display: "inline-block",
          width: `${label.columnEm}em`,
          textIndent: 0,
        }}
      >
        <ReaderInlineContent inlines={prefix} />
      </span>
      <ReaderInlineContent inlines={body} />
    </>
  );
}

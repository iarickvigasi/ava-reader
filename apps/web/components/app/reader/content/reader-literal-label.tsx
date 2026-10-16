import type { ReaderInline } from "@/lib/api-types/reader-content";
import { groupInlineLinkOccurrences } from "@/features/reader/group-inline-link-occurrences";
import { splitLiteralPrefix } from "@/features/reader/split-literal-prefix";
import { ReaderInlineContent } from "./reader-inline-content";
import { ReaderContentLink } from "./reader-content-link";

type Label = { end: number; columnEm: number };
export function ReaderLiteralLabel({
  inlines,
  label,
  before,
  after,
}: {
  inlines: ReaderInline[];
  label: Label;
  before?: string;
  after?: string;
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
    const remaining = inlines.slice(first.inlines.length);
    return (
      <>
        <ReaderContentLink link={first.inlines[0]}>
          <LabelContent inlines={content} label={label} before={before} after={edgeText(remaining[0], after)} />
        </ReaderContentLink>
        <ReaderInlineContent inlines={remaining} before={edgeText(content.at(-1), before)} after={after} />
      </>
    );
  }
  return <LabelContent inlines={inlines} label={label} before={before} after={after} />;
}

function LabelContent({
  inlines,
  label,
  before,
  after,
}: {
  inlines: ReaderInline[];
  label: Label;
  before?: string;
  after?: string;
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
        <ReaderInlineContent inlines={prefix} before={before} after={edgeText(body[0], after)} />
      </span>
      <ReaderInlineContent inlines={body} before={edgeText(prefix.at(-1), before)} after={after} />
    </>
  );
}

function edgeText(inline: ReaderInline | undefined, fallback?: string) {
  return inline ? (inline.kind === "text" ? inline.text : "") : fallback;
}

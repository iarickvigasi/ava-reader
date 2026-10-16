import type { ReaderInline } from "@/lib/api-types";
import { intrinsicScriptRuns } from "@/features/reader/intrinsic-script-runs";
import { ReaderInlineScript } from "./reader-inline-script";
import { ReaderInlineText } from "./reader-inline-text";

type TextInline = Extract<ReaderInline, { kind: "text" }>;

export function ReaderScriptText({
  inline,
  before,
  after,
}: {
  inline: TextInline;
  before?: string;
  after?: string;
}) {
  const script = inline.script ??
    (inline.presentation?.vertical_align === "super" ||
    inline.presentation?.vertical_align === "sub"
      ? inline.presentation.vertical_align
      : undefined);
  return intrinsicScriptRuns(inline.text, script, before, after).map((run, index) => (
    <ReaderInlineScript
      key={index}
      inheritSize={inline.presentation?.relative_size != null}
      script={run.script}
    >
      <ReaderInlineText inline={{ ...inline, text: run.text }} />
    </ReaderInlineScript>
  ));
}

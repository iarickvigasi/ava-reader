import type { Style } from "@/lib/api-types/canonical-reader.generated";
import type { ReaderInline } from "@/lib/api-types/reader-content";
import { splitAtBreakOpportunities } from "../break-opportunities";

type TextInline = Extract<ReaderInline, { kind: "text" }>;
export type InlineViewGroup = {
  inline: TextInline & { presentation: Style };
  key: string;
  coalescible: boolean;
  parts: string[];
};

// Coalescing must preserve the renderer's long-token <wbr> opportunities.
// Scan each group's original parts and joined text once. Keep original seams
// when joining would introduce/remove a break; never change canonical text.
export function inlineViewRuns(groups: InlineViewGroup[]): ReaderInline[] {
  return groups.flatMap(({ inline, parts }) => {
    const text = parts.join("");
    if (parts.length === 1 || sameBreakOffsets(parts, text))
      return [{ ...inline, text }];
    let sourceOffset = inline.sourceOffset ?? 0;
    return parts.map((text) => {
      const run = {
        ...inline,
        presentation: { ...inline.presentation },
        text,
        sourceOffset,
      };
      sourceOffset += text.length;
      return run;
    });
  });
}

function sameBreakOffsets(parts: string[], joined: string) {
  const offsets = (runs: string[]) => {
    const result: number[] = [];
    let offset = 0;
    for (const run of runs) {
      const slices = splitAtBreakOpportunities(run);
      slices.forEach((slice, index) => {
        offset += slice.length;
        if (index < slices.length - 1) result.push(offset);
      });
    }
    return result;
  };
  const before = offsets(parts);
  const after = offsets([joined]);
  return (
    before.length === after.length &&
    before.every((offset, index) => offset === after[index])
  );
}

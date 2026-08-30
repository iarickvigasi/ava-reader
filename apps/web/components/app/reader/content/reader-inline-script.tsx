import type { ReactNode } from "react";
import type { ReaderInline } from "@/lib/api-types";

type InlineScript = Extract<ReaderInline, { kind: "text" }>["script"];

// Raises or lowers a run, so `10<sup>500</sup>` reads as a power. Deliberately
// class-free: Tailwind's preflight already applies the normalize treatment to
// `sup`/`sub` (75%, line-height 0, baseline-aligned, offset by top/bottom), so
// the glyph paints off the baseline without growing the line box — a paragraph
// holding an exponent keeps its neighbours' leading, and the line-box rule
// pagination depends on (spec 1.1 §5) holds.
export function ReaderInlineScript({
  children,
  script,
}: {
  children: ReactNode;
  script: InlineScript;
}) {
  if (script === "super") {
    return <sup>{children}</sup>;
  }

  if (script === "sub") {
    return <sub>{children}</sub>;
  }

  return <>{children}</>;
}

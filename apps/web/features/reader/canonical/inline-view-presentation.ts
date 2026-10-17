import type {
  CanonicalBookV2,
  Style,
} from "@/lib/api-types/canonical-reader.generated";
import { canonicalStyle } from "./style";

export type InlineParent = {
  kind: CanonicalBookV2["blocks"][number]["kind"] | "table-cell";
  presentation?: Style;
};
const INHERITED_PROPERTIES = {
  bold: "fontWeight",
  italic: "fontStyle",
  small_caps: "fontVariant",
  family: "fontFamily",
  color: "color",
} as const;

// These parent declarations survive resolveBlockStyle/structuredLeafStyle and
// override heading/quote/header defaults. No default is inferred from null.
export function inlineViewPresentation(parent?: InlineParent) {
  const inherited = canonicalStyle(parent?.presentation);
  // Prepared descriptors live only for this TextValue projection. Native spans
  // often repeat one style; never retain expanded windows against the book.
  const prepared = new Map<Style, { presentation: Style; key: string }>();
  return (presentation: Style, linked: boolean) => {
    if (!parent || linked) return { presentation, key: "" };
    const prior = prepared.get(presentation);
    if (prior) return prior;
    const view = { ...presentation };
    const inline = canonicalStyle(presentation);
    for (const [key, css] of Object.entries(INHERITED_PROPERTIES)) {
      // Ordinary code adds a <code> whose preflight font overrides its parent.
      if (key === "family" && parent.kind === "code") continue;
      if (inherited[css] !== undefined && inherited[css] === inline[css])
        delete view[key as keyof typeof INHERITED_PROPERTIES];
    }
    // A 1em inline inherits the resolved block/cell size; other sizes multiply
    // it. Sup/sub uses the declaration's presence to suppress preflight's 75%.
    if (
      view.relative_size === 1 &&
      !["super", "sub"].includes(view.vertical_align ?? "")
    )
      delete view.relative_size;
    // vertical-align is not inherited; an ordinary inline starts at baseline.
    if (view.vertical_align === "baseline") delete view.vertical_align;
    const result = { presentation: view, key: inlinePresentationKey(view) };
    prepared.set(presentation, result);
    return result;
  };
}

function inlinePresentationKey(style: Style) {
  return JSON.stringify(
    Object.entries(style)
      .filter(([key]) => key !== "id")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

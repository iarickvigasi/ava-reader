import { useState } from "react";
import type { SavedComment, ToolKey } from "./saved-comments";

// Multi-open accordion: each tool has its own open/closed state. Opening one
// does NOT collapse the others. On first sight of a selection we auto-expand
// the tools that already have a saved result so the user immediately sees
// their prior comments; subsequent toggles are user-driven.
export function useToolAccordion(
  locator: string | undefined,
  savedComments: Partial<Record<ToolKey, SavedComment>>,
): {
  openTools: ReadonlySet<ToolKey>;
  toggle: (tool: ToolKey) => void;
} {
  const [openTools, setOpenTools] = useState<ReadonlySet<ToolKey>>(
    () => new Set(),
  );

  // We adjust state during render (rather than in an effect) using the
  // "previous-prop" pattern documented at
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders —
  // React throws away the in-progress render and starts a new one, so this
  // doesn't trigger a cascading commit.
  const [autoExpandedLocator, setAutoExpandedLocator] = useState<
    string | undefined
  >(undefined);
  if (locator !== autoExpandedLocator) {
    setAutoExpandedLocator(locator);
    setOpenTools(new Set(Object.keys(savedComments) as ToolKey[]));
  }

  const toggle = (tool: ToolKey) => {
    setOpenTools((current) => {
      const next = new Set(current);
      if (next.has(tool)) {
        next.delete(tool);
      } else {
        next.add(tool);
      }
      return next;
    });
  };

  return { openTools, toggle };
}

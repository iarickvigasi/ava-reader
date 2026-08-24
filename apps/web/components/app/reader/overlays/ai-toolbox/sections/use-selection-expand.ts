import { useState } from "react";
import { useReaderSelectionContext } from "../../../selection/reader-selection-context";

// Expand/collapse for the toolbox selection strip quote (spec 3, Behaviour 7):
// collapsed is one truncated line, expanded shows the full fragment.
export function useSelectionExpand(): {
  isExpanded: boolean;
  toggleExpanded: () => void;
} {
  const { text } = useReaderSelectionContext();
  const [isExpanded, setIsExpanded] = useState(false);

  // A new selection snaps the strip back to collapsed. State is adjusted
  // during render via the "previous-prop" pattern (see use-tool-accordion).
  const [expandedForText, setExpandedForText] = useState(text);
  if (text !== expandedForText) {
    setExpandedForText(text);
    setIsExpanded(false);
  }

  const toggleExpanded = () => setIsExpanded((current) => !current);

  return { isExpanded, toggleExpanded };
}

import { normalizeDescriptionNodes } from "./normalize-description-nodes";
import { normalizePlainDescription } from "./normalize-plain-description";
import { readDescriptionFragment } from "./read-description-fragment";
import type { DescriptionBlock } from "./types";

export function parseBookDescription(description: string | null): DescriptionBlock[] {
  if (!description?.trim()) return [];
  const { childNodes } = readDescriptionFragment(description);
  if (childNodes.some((node) => "tagName" in node)) {
    return normalizeDescriptionNodes(childNodes);
  }
  const text = childNodes.map((node) => ("value" in node ? node.value : "")).join("");
  return normalizePlainDescription(text);
}

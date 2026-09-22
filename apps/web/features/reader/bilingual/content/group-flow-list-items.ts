import type { ReaderBlock } from "@/lib/api-types/reader";
import type { BilingualFlowUnit } from "./flow-types";
import { resolveInlineSource } from "./source-inlines";

export function groupFlowListItems(
  block: Extract<ReaderBlock, { kind: "list" }>,
  units: BilingualFlowUnit[],
) {
  const groups: {
    id: string;
    itemIndex: number;
    startOffset: number;
    units: BilingualFlowUnit[];
  }[] = [];
  for (const entry of units) {
    const id = entry.unit.itemId ?? entry.unit.id;
    const previous = groups.at(-1);
    if (previous?.id === id) {
      previous.units.push(entry);
      continue;
    }
    const source = resolveInlineSource(block, entry.unit.itemId);
    groups.push({
      id,
      itemIndex: source?.itemIndex ?? 0,
      startOffset: source?.offset ?? entry.unit.startOffset,
      units: [entry],
    });
  }
  return groups;
}

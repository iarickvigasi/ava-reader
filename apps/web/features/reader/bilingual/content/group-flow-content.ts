import type { BilingualUnit } from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types/reader";
import type { BilingualFlowGroup } from "./flow-types";

export function groupFlowContent(
  units: readonly BilingualUnit[],
  blocks: ReaderBlock[],
  indexes: readonly number[],
) {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const groups: BilingualFlowGroup[] = [];
  for (const index of indexes) {
    const unit = units[index];
    if (!unit) continue;
    const previous = groups.at(-1);
    const last = previous?.units.at(-1);
    if (
      previous?.block.id === unit.blockId &&
      last?.index === index - 1 &&
      unit.kind !== "image"
    ) {
      previous.units.push({ unit, index });
    } else {
      const block =
        byId.get(unit.blockId) ??
        ({
          id: unit.blockId,
          kind: "paragraph",
          text: unit.text,
          inlines: [{ kind: "text", text: unit.text }],
        } satisfies ReaderBlock);
      groups.push({ block, units: [{ unit, index }] });
    }
  }
  return groups;
}

import { flowBlockIndex } from "./flow-block-index";
import type { BilingualUnit } from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types/reader";
import type { BilingualFlowGroup } from "./flow-types";

export function groupFlowContent(
  units: readonly BilingualUnit[],
  blocks: ReaderBlock[],
  indexes: readonly number[],
) {
  const byId = flowBlockIndex(blocks);
  const groups: BilingualFlowGroup[] = [];
  for (const index of indexes) {
    const unit = units[index];
    if (!unit) continue;
    const root = byId.get(unit.blockId);
    const previous = groups.at(-1);
    const last = previous?.units.at(-1);
    if (
      previous?.block.id === (root?.id ?? unit.blockId) &&
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
      const descriptions =
        block.kind === "image"
          ? [block.captionId, block.creditId].flatMap((id) => {
              const description = id ? byId.get(id) : undefined;
              return description &&
                (description.kind === "caption" ||
                  description.kind === "credit")
                ? [description]
                : [];
            })
          : undefined;
      groups.push({ block, units: [{ unit, index }], descriptions });
    }
  }
  return groups;
}

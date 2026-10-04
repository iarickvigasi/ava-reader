import type { BilingualFlowBlockProps } from "@/features/reader/bilingual/content/flow-types";
import type { ReaderListBlock } from "@/lib/api-types/reader-content";
import { canonicalStyle } from "@/features/reader/canonical/style";
import { canonicalLeaf } from "@/features/reader/bilingual/content/canonical-leaf";
import { resolveBlockStyle } from "../../content/reader-block-style";
import { structuredLeafStyle } from "../../content/structured-leaf-style";
import { LIST_CLASS } from "../../content/reader-block-classes";
import { BilingualFlowSentences } from "./bilingual-flow-sentences";
export function BilingualStructuredList(props: BilingualFlowBlockProps) {
  const selected = new Set(
    props.group.units.map(({ unit }) => unit.itemId ?? unit.blockId),
  );
  const contains = (list: ReaderListBlock): boolean =>
    list.items.some(
      (item) => selected.has(item.id) || item.children?.some(contains),
    );
  const render = (list: ReaderListBlock) => {
    const Tag = list.ordered ? "ol" : "ul";
    return (
      <Tag
        key={list.id}
        data-bilingual-flow-content
        dir="auto"
        start={list.ordered ? list.start : undefined}
        className={`[--reader-list-base:1.12rem] sm:[--reader-list-base:1.28rem] ${LIST_CLASS} ${list.ordered ? "list-decimal" : "list-disc"}`}
        style={{
          ...(list.canonical
            ? canonicalStyle(list.presentation)
            : resolveBlockStyle(list)),
          listStyleType:
            list.markerStyle === "bullet"
              ? "disc"
              : (list.markerStyle ?? undefined),
        }}
      >
        {list.items.map((item, index) => {
          const units = props.group.units.filter(
            ({ unit }) => (unit.itemId ?? unit.blockId) === item.id,
          );
          const children = item.children?.filter(contains) ?? [];
          if (!units.length && !children.length) return null;
          const leaf = canonicalLeaf(list, item.id)!;
          return (
            <li
              key={item.id}
              value={list.ordered ? (list.start ?? 1) + index : undefined}
              data-bilingual-flow-item={item.id}
              data-bilingual-flow-item-start={0}
              style={{
                ...structuredLeafStyle(item, "list"),
                ...(!units.length || units[0].unit.startOffset > 0
                  ? { listStyleType: "none" }
                  : {}),
              }}
            >
              <BilingualFlowSentences {...props} block={leaf} units={units} />
              {children.map(render)}
            </li>
          );
        })}
      </Tag>
    );
  };
  return props.group.block.kind === "list" ? render(props.group.block) : null;
}

import type { DescriptionBlock } from "@/features/library/book-description/types";
import { cn } from "@/lib/cn";
import { DescriptionInlines } from "./description-inlines";

export function DescriptionBlocks({ blocks }: { blocks: DescriptionBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index}>
              <DescriptionInlines inlines={block.children} />
            </p>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote key={index} className="space-y-4 ps-6 text-copy-strong">
              <DescriptionBlocks blocks={block.children} />
            </blockquote>
          );
        }

        const List = block.ordered ? "ol" : "ul";
        return (
          <List
            key={index}
            className={cn(
              "space-y-2 ps-6 marker:text-muted",
              block.ordered ? "list-decimal" : "list-disc",
            )}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="space-y-2">
                <DescriptionBlocks blocks={item} />
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}

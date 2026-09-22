import type {
  BilingualChapter,
  BilingualUnit,
} from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types/reader";

export type BilingualFlowUnit = { unit: BilingualUnit; index: number };
export type BilingualFlowGroup = {
  block: ReaderBlock;
  units: BilingualFlowUnit[];
};
export type BilingualFlowProps = {
  chapter: BilingualChapter;
  blocks: ReaderBlock[];
  unitIndexes: readonly number[];
  side: "source" | "translation";
  pageHeight: number;
};
export type BilingualFlowBlockProps = Pick<
  BilingualFlowProps,
  "chapter" | "side" | "pageHeight"
> & {
  group: BilingualFlowGroup;
};

import type { ReaderBlock } from '../reader-types';
import type { EpubAsset } from './archive';
import type { StylesheetHintMap } from './css/build-stylesheet-hints';
import { OrderedNode } from './xml-utils';
import { normalizeBlockNode } from './blocks/block-normalizer';

export async function normalizeBlocksFromNodes(
  nodes: OrderedNode[],
  chapterId: string,
  resolveAsset: (assetPath: string) => Promise<EpubAsset | null>,
  stylesheetHints?: StylesheetHintMap,
) {
  let blockIndex = 0;
  const blocks: ReaderBlock[] = [];

  const createBlockId = () => {
    blockIndex += 1;
    return `${chapterId}::b${blockIndex}`;
  };

  for (const node of nodes) {
    const normalized = await normalizeBlockNode(node, {
      chapterId,
      createBlockId,
      resolveAsset,
      stylesheetHints,
    });

    if (Array.isArray(normalized)) {
      blocks.push(...normalized);
    } else if (normalized) {
      blocks.push(normalized);
    }
  }

  return blocks;
}

import type { ReaderBlock } from '../../reader-types';
import { applyBlockStyleHints } from './block-style-hints';
import type { BlockContext } from './block-context';

export function buildSeparatorBlock(context: BlockContext): ReaderBlock {
  return applyBlockStyleHints(
    {
      id: context.createBlockId(),
      anchorId: context.anchorId,
      kind: 'separator' as const,
      text: '',
    },
    context.hints,
  );
}

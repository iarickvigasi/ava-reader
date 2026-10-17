import type {
  ReaderBlock,
  ReaderInline,
  ReaderTextBlock,
} from '../../reader-types';
import type { ReaderLinkTarget } from '../../reader-link-target';

export function resolveBlockLinks(
  blocks: ReaderBlock[],
  resolveInline: (inline: ReaderInline, offset: number) => ReaderInline,
  resolveImage: (block: Extract<ReaderBlock, { kind: 'image' }>) => ReaderBlock,
  resolveReturn?: (target: ReaderLinkTarget) => ReaderLinkTarget,
): ReaderBlock[] {
  const inlines = (items: ReaderInline[]) => {
    let offset = 0;
    return items.map((inline) => {
      const result = resolveInline(inline, offset);
      if (inline.kind === 'text') offset += inline.text.length;
      return result;
    });
  };
  return blocks.map((block) => {
    if ('inlines' in block) {
      const mapped = {
        ...block,
        inlines: inlines(block.inlines),
        ...(block.kind === 'note' && block.returns && resolveReturn
          ? {
              returns: block.returns.map((action) => ({
                ...action,
                target: resolveReturn(action.target),
              })),
            }
          : {}),
      };
      if (block.kind !== 'note' || !block.pendingReturns) return mapped;
      const stored = { ...mapped } as ReaderTextBlock;
      delete stored.pendingReturns;
      return {
        ...stored,
        returns: block.pendingReturns.map((action) => {
          const link = resolveInline(
            { kind: 'text', text: action.label, href: action.href },
            block.text.length,
          );
          if (!link.target)
            throw new Error(
              'The EPUB note backlink has no internal destination.',
            );
          return { label: action.label, target: link.target };
        }),
      };
    }
    if (block.kind === 'image') return resolveImage(block);
    if (block.kind === 'table')
      return {
        ...block,
        cells: block.cells.map((cell) => ({
          ...cell,
          inlines: inlines(cell.inlines),
        })),
      };
    if (block.kind === 'list')
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          inlines: inlines(item.inlines),
          ...(item.children
            ? {
                children: resolveBlockLinks(
                  item.children,
                  resolveInline,
                  resolveImage,
                  resolveReturn,
                ) as typeof item.children,
              }
            : {}),
        })),
      };
    return block;
  });
}

import { posix } from 'path';
import type { ReaderChapter } from '../../reader-types';
import type { ReaderLinkTarget } from '../../reader-link-target';
import { sourceBlockParts } from './source-block-parts';

export const sourceAddressKey = (path: string, anchor: string) =>
  JSON.stringify([posix.normalize(path), anchor]);
export function sourceAddressIndex(chapters: ReaderChapter[]) {
  const addresses = new Map<string, ReaderLinkTarget | null>();
  const add = (path: string, anchor: string, target: ReaderLinkTarget) => {
    const key = sourceAddressKey(path, anchor);
    const before = addresses.get(key);
    if (!addresses.has(key)) addresses.set(key, target);
    else if (!before || JSON.stringify(before) !== JSON.stringify(target))
      addresses.set(key, null);
  };
  for (const chapter of chapters) {
    const path = decodeURIComponent(chapter.href.split('#')[0]);
    const parts = sourceBlockParts(chapter.blocks);
    for (const [index, part] of parts.entries()) {
      const target = {
        chapterId: chapter.chapterId,
        blockId: part.id,
        textOffset: 0,
        ...('kind' in part && part.kind === 'note'
          ? { note: true as const }
          : {}),
      };
      if (index === 0 && !addresses.has(sourceAddressKey(path, '')))
        add(path, '', target);
      for (const alias of [part.anchorId, ...(part.anchorIds ?? [])].filter(
        (id): id is string => Boolean(id),
      ))
        add(path, alias, target);
      for (const alias of part.sourceAnchors ?? []) {
        if (
          !Number.isInteger(alias.textOffset) ||
          alias.textOffset < 0 ||
          alias.textOffset > part.text.length
        )
          throw new Error(
            'The EPUB source anchor has an invalid text position.',
          );
        add(path, alias.id, { ...target, textOffset: alias.textOffset });
      }
      let offset = 0;
      for (const inline of 'inlines' in part ? part.inlines : []) {
        for (const anchor of inline.anchorIds ?? [])
          add(path, anchor, { ...target, textOffset: offset });
        if (inline.kind === 'text') offset += inline.text.length;
      }
    }
  }
  return addresses;
}

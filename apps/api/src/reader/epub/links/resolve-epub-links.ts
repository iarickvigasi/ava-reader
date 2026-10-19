import { posix } from 'path';
import type { ReaderChapter } from '../../reader-types';
import { sourceAddressIndex, sourceAddressKey } from './source-address-index';
import { resolveBlockLinks } from './resolve-block-links';

// Internal references are reader positions, never relative browser navigations.
export function resolveEpubLinks(chapters: ReaderChapter[]): ReaderChapter[] {
  const addresses = sourceAddressIndex(chapters);
  return chapters.map((chapter) => {
    const path = decodeURIComponent(chapter.href.split('#')[0]);
    const resolve = <T extends { href?: string }>(
      item: T,
      offset: number,
    ): T => {
      const href = item.href;
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//'))
        return item;
      const hash = href.indexOf('#');
      const file = decodeURIComponent(hash < 0 ? href : href.slice(0, hash));
      const anchor = decodeURIComponent(hash < 0 ? '' : href.slice(hash + 1));
      const destination = file
        ? posix.normalize(posix.join(posix.dirname(path), file))
        : path;
      const target = addresses.get(sourceAddressKey(destination, anchor));
      if (!target)
        throw new Error(
          'The EPUB has a missing or ambiguous internal reference.',
        );
      return { ...item, sourceOffset: offset, target };
    };
    return {
      ...chapter,
      blocks: resolveBlockLinks(chapter.blocks, resolve, (block) =>
        resolve(block, 0),
      ),
    };
  });
}

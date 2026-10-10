import { createHash } from 'crypto';
import {
  getNodeAttributes,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';
import {
  EpubSourceFindingError,
  type EpubSourceFinding,
} from '../source-finding';
import type { BlockContext } from './block-context';

export function unsupportedSourceStructure(
  code: EpubSourceFinding['code'],
  node: OrderedNode,
  context: Pick<BlockContext, 'sourcePath' | 'attrs'>,
): never {
  const attrs = getNodeAttributes(node);
  const tag = getNodeTagName(node);
  if (tag !== 'li' && tag !== 'td' && tag !== 'th' && tag !== 'img')
    throw new Error('Invalid EPUB source finding element.');
  const treePath = context.sourcePath ?? [0];
  const identity = (value?: string) =>
    value ? createHash('sha256').update(value).digest('hex') : undefined;
  throw new EpubSourceFindingError({
    schema: 'ava.epub-source-finding.v1',
    code,
    source: {
      elementTag: tag,
      siblingIndex: treePath.at(-1)!,
      treePath,
      elementIdSha256: identity(attrs['@_id']),
      ...(attrs['@_name'] ? { nameSha256: identity(attrs['@_name']) } : {}),
      parentIdSha256: identity(
        context.attrs['@_id'] ?? context.attrs['@_name'],
      ),
    },
  });
}

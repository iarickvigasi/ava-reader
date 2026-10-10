import type { ReaderTextBlock } from '../../reader-types';
import { getNodeAttributes, getNodeChildren } from '../xml-utils';
import { normalizeInlineNodes, buildInlineText } from './inline';
import { buildInlineBlock } from './build-inline-block';
import { backlinkSourceAliases } from './backlink-source-aliases';
import { splitNoteBacklinks } from './split-note-backlinks';
import { getNoteRole } from './note-role';
import type { BlockContext, BlockResult } from './block-context';

export async function buildNoteBlock(
  context: BlockContext,
): Promise<BlockResult> {
  const { body, backlinks } = splitNoteBacklinks(context.children);
  const result = await buildInlineBlock({ ...context, children: body }, 'note');
  if (!result) return null;
  if (Array.isArray(result) || result.kind !== 'note')
    throw new Error(
      'The EPUB note contains an unsupported standalone illustration.',
    );
  const pendingReturns: NonNullable<ReaderTextBlock['pendingReturns']> = [];
  const aliases: string[] = [];
  for (const node of backlinks) {
    const attrs = getNodeAttributes(node);
    const href = attrs['@_href'];
    if (!href) throw new Error('The EPUB note backlink has no destination.');
    const label = buildInlineText(
      await normalizeInlineNodes(getNodeChildren(node), context.resolveAsset, {
        language: context.hints.language,
        stylesheetHints: context.stylesheetHints,
        ancestors: context.ancestors,
      }),
    );
    pendingReturns.push({ label, href });
    aliases.push(...backlinkSourceAliases(node));
  }
  return {
    ...result,
    noteRole: getNoteRole(context.attrs),
    pendingReturns,
    sourceAnchors: [
      ...(result.sourceAnchors ?? []),
      ...aliases.map((id) => ({ id, textOffset: result.text.length })),
    ],
  };
}

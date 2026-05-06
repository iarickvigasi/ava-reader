import type { ReaderBlock } from '../reader-types';
import { normalizeHrefForLookup } from './archive';
import type { ParsedTocNode } from './toc/types';
import { extractAnchorIdFromHref, normalizeAnchorForLookup } from './toc/utils';

export function createChapterId(
  spineIndex: number,
  href: string,
  anchorId?: string | null,
) {
  const base =
    href
      .split('/')
      .at(-1)
      ?.replace(/\.[^.]+$/, '') ?? 'chapter';
  const slug = toSlug(base);
  const anchorSlug = anchorId ? toSlug(anchorId) : '';
  const anchorSuffix = anchorSlug ? `--${anchorSlug}` : '';
  return `chapter-${spineIndex + 1}${slug ? `-${slug}` : ''}${anchorSuffix}`;
}

export function getChapterTitleFromBlocks(blocks: ReaderBlock[]) {
  for (const block of blocks) {
    if (block.kind === 'heading' && block.text.trim().length > 0) {
      return block.text.trim();
    }
  }

  return null;
}

export function resolveChapterFallbackLabel(input: {
  bookTitle: string;
  candidateLabel: string | null;
  chapterTitle: string | null;
  spineIndex: number;
}) {
  const normalizedBookTitle = normalizeTitleForComparison(input.bookTitle);
  const candidateLabels = [input.candidateLabel, input.chapterTitle];

  for (const candidate of candidateLabels) {
    if (!candidate) {
      continue;
    }

    if (normalizeTitleForComparison(candidate) === normalizedBookTitle) {
      continue;
    }

    return candidate;
  }

  return `Chapter ${input.spineIndex + 1}`;
}

/**
 * Build a `spinePathKey -> Set<normalizedAnchorId>` index from the parsed TOC.
 *
 * Many EPUBs (e.g. Project Gutenberg's "Pride and Prejudice") pack dozens of
 * logical chapters into a handful of XHTML spine files, separating them only
 * with anchor IDs that the TOC links to. We use this index during package
 * construction to know which anchors inside a given spine doc start a new
 * logical chapter so we can split the doc's block stream at those anchors.
 */
export function collectTocAnchorsBySpinePath(
  toc: ParsedTocNode[],
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  walk(toc);

  return result;

  function walk(nodes: ParsedTocNode[]) {
    for (const node of nodes) {
      if (node.href) {
        const hashIndex = node.href.indexOf('#');
        if (hashIndex >= 0) {
          const pathPart = node.href.slice(0, hashIndex);
          const anchor = extractAnchorIdFromHref(node.href);
          if (anchor && pathPart) {
            const key = normalizeHrefForLookup(pathPart);
            const existing = result.get(key) ?? new Set<string>();
            existing.add(normalizeAnchorForLookup(anchor));
            result.set(key, existing);
          }
        }
      }
      walk(node.children);
    }
  }
}

export type ChapterSegment = {
  blocks: ReaderBlock[];
  /**
   * The anchor ID that starts this segment. `null` for the leading segment of
   * a spine doc when there is content before the first split anchor (or when
   * the doc has no anchors at all).
   */
  leadingAnchorId: string | null;
};

/**
 * Split a spine document's blocks into one segment per TOC-anchor boundary.
 *
 * The first block whose `anchorId` matches an entry in `tocAnchorIds` starts
 * the second segment, the next match starts the third, and so on. Anything
 * before the first matching anchor becomes a leading segment with
 * `leadingAnchorId === null`. If the doc has zero matching anchors we return
 * a single segment containing all blocks.
 */
export function splitBlocksAtTocAnchors(
  blocks: ReaderBlock[],
  tocAnchorIds: Set<string>,
): ChapterSegment[] {
  if (blocks.length === 0) {
    return [];
  }

  if (tocAnchorIds.size === 0) {
    return [{ blocks, leadingAnchorId: null }];
  }

  const segments: ChapterSegment[] = [];
  let currentLeadingAnchor: string | null = null;
  let currentBlocks: ReaderBlock[] = [];

  for (const block of blocks) {
    const blockAnchor = block.anchorId ?? null;
    const isSplitAnchor =
      blockAnchor !== null &&
      tocAnchorIds.has(normalizeAnchorForLookup(blockAnchor));

    if (isSplitAnchor) {
      if (currentBlocks.length > 0) {
        segments.push({
          blocks: currentBlocks,
          leadingAnchorId: currentLeadingAnchor,
        });
      }
      currentLeadingAnchor = blockAnchor;
      currentBlocks = [block];
    } else {
      currentBlocks.push(block);
    }
  }

  if (currentBlocks.length > 0) {
    segments.push({
      blocks: currentBlocks,
      leadingAnchorId: currentLeadingAnchor,
    });
  }

  return segments;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeTitleForComparison(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

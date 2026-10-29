import { BadRequestException } from '@nestjs/common';
import type { ReaderPackage } from '../../reader/reader-types';

export function assessPackage(pkg: ReaderPackage, checksum: string) {
  const blocks = pkg.chapters.flatMap((chapter) => chapter.blocks);
  const paragraphs = blocks.filter(
    (block) => block.kind === 'paragraph' || block.kind === 'blockquote',
  );
  const text = paragraphs.map((block) => block.text).join('\n');
  const replacementCharacters = (text.match(/\uFFFD/g) ?? []).length;
  if (
    pkg.manifest.sourceChecksum !== checksum ||
    pkg.chapters.length === 0 ||
    !pkg.toc.length ||
    paragraphs.length < 5 ||
    text.length < 1000 ||
    replacementCharacters / text.length > 0.001
  )
    throw new BadRequestException(
      'Reader quality gate failed: missing/insufficient text, navigation, or damaged encoding',
    );
  return {
    paragraphs: paragraphs.length,
    characters: text.length,
    chapters: pkg.chapters.length,
    replacementCharacters,
    ruleVersion: 1,
  };
}

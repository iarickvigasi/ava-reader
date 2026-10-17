import { z } from 'zod';

const index = z.number().int().min(0).max(1_000_000);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const resourcePath = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (value) =>
      !value.includes('\\') &&
      Array.from(value).every(
        (char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127,
      ) &&
      !value.startsWith('/') &&
      !/^[a-z][a-z0-9+.-]*:/i.test(value) &&
      value
        .split('/')
        .every((part) => part !== '..' && part !== '.' && part !== ''),
  );
export const sourceFindingSchema = z
  .object({
    schema: z.literal('ava.epub-source-finding.v1'),
    code: z.enum([
      'EPUB_UNSUPPORTED_LIST_FLOW',
      'EPUB_UNSUPPORTED_TABLE_CELL',
      'EPUB_REQUIRED_IMAGE_MISSING',
    ]),
    source: z
      .object({
        resourcePath: resourcePath.optional(),
        elementTag: z.enum(['li', 'td', 'th', 'img']),
        siblingIndex: index,
        treePath: z.array(index).min(1).max(64),
        elementIdSha256: hash.optional(),
        nameSha256: hash.optional(),
        parentIdSha256: hash.optional(),
      })
      .strict()
      .refine((source) => source.siblingIndex === source.treePath.at(-1)),
  })
  .strict()
  .refine((finding) =>
    finding.code === 'EPUB_UNSUPPORTED_LIST_FLOW'
      ? finding.source.elementTag === 'li'
      : finding.code === 'EPUB_REQUIRED_IMAGE_MISSING'
        ? finding.source.elementTag === 'img'
        : ['td', 'th'].includes(finding.source.elementTag),
  );
export type EpubSourceFinding = z.infer<typeof sourceFindingSchema>;
export class EpubSourceFindingError extends Error {
  readonly finding: EpubSourceFinding;
  constructor(finding: EpubSourceFinding) {
    super('This EPUB contains a structure AVA cannot preserve.');
    this.name = 'EpubSourceFindingError';
    this.finding = sourceFindingSchema.parse(finding);
  }
  withResourcePath(path: string): EpubSourceFindingError {
    return new EpubSourceFindingError({
      ...this.finding,
      source: { ...this.finding.source, resourcePath: path },
    });
  }
}

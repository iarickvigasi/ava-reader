import type { Tx } from '../importer/types';
import { metadataOverrides } from './metadata-overrides';
export async function readMetadataOverrides(
  tx: Tx,
  kind: 'works' | 'authors' | 'editions',
  id: string,
  data: Record<string, unknown>,
) {
  const current =
    kind === 'works'
      ? await tx.work.findUniqueOrThrow({
          where: { id },
          include: { texts: true, credits: true },
        })
      : kind === 'authors'
        ? await tx.author.findUniqueOrThrow({
            where: { id },
            include: { texts: true, aliases: true },
          })
        : await tx.edition.findUniqueOrThrow({
            where: { id },
            include: {
              credits: true,
              identifiers: { include: { identifier: true } },
            },
          });
  return metadataOverrides(current, data);
}

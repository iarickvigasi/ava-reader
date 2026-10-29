import type { Tx } from './types';
export async function writeImportCredits(
  tx: Tx,
  kind: 'work' | 'edition',
  id: string,
  authors: string[],
  overrides: string[],
  conflicts: string[],
) {
  const current =
    kind === 'work'
      ? await tx.workCredit.findMany({ where: { workId: id } })
      : await tx.editionCredit.findMany({ where: { editionId: id } });
  let position = current.reduce(
    (max, row) => Math.max(max, row.position + 1),
    0,
  );
  for (const authorId of authors) {
    if (overrides.includes(`credits:${authorId}:AUTHOR`)) {
      conflicts.push('credits');
      continue;
    }
    if (
      current.some((row) => row.authorId === authorId && row.role === 'AUTHOR')
    )
      continue;
    const data = { authorId, position: position++, role: 'AUTHOR' as const };
    if (kind === 'work')
      await tx.workCredit.create({ data: { workId: id, ...data } });
    else await tx.editionCredit.create({ data: { editionId: id, ...data } });
  }
}

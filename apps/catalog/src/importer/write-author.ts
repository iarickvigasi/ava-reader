import { strings, text } from './raw-fields';
import type { Raw, Tx } from './types';

export async function writeAuthor(
  tx: Tx,
  id: string,
  revision: number,
  raw: Raw,
) {
  const displayName = text(raw.name)!;
  await tx.author.upsert({
    where: { id },
    create: { id, displayName, revision },
    update: { displayName, revision },
  });
  const aliases = strings(raw.alternate_names);
  if (aliases) {
    await tx.authorAlias.deleteMany({ where: { authorId: id } });
    await tx.authorAlias.createMany({
      data: aliases.map((name) => ({ authorId: id, name })),
    });
  }
  const biography = text(raw.bio);
  if (biography)
    await tx.authorText.upsert({
      where: { authorId_locale: { authorId: id, locale: 'und' } },
      create: { authorId: id, locale: 'und', biography },
      update: { biography },
    });
}

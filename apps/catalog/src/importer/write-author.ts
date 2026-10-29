import { strings, text } from './raw-fields';
import { mergeMetadata } from './merge-metadata';
import { writeImportTexts } from './write-import-texts';
import type { Raw, Tx } from './types';

export async function writeAuthor(
  tx: Tx,
  id: string,
  revision: number,
  raw: Raw,
  conflicts: string[] = [],
) {
  const current = await tx.author.findUnique({ where: { id } });
  const incoming = { displayName: text(raw.name)!, revision };
  await tx.author.upsert({
    where: { id },
    create: { id, ...incoming },
    update: mergeMetadata(current, incoming, conflicts),
  });
  const overrides = current?.metadataOverrides ?? [];
  const aliases = strings(raw.alternate_names) ?? [];
  const allowed = aliases.filter(
    (name) => !overrides.includes(`aliases:${name}`),
  );
  if (allowed.length !== aliases.length) conflicts.push('aliases');
  if (allowed.length)
    await tx.authorAlias.createMany({
      data: allowed.map((name) => ({ authorId: id, name })),
      skipDuplicates: true,
    });
  await writeImportTexts(tx, 'author', id, raw, overrides, conflicts);
}

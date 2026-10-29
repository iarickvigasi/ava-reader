import { importTextLocale } from './import-text-locale';
import { mergeMetadata } from './merge-metadata';
import { object, text } from './raw-fields';
import { normalizeLanguage } from './normalize-language';
import type { Raw, Tx } from './types';

export async function writeImportTexts(
  tx: Tx,
  kind: 'author' | 'work',
  id: string,
  raw: Raw,
  overrides: string[],
  conflicts: string[],
) {
  const work = kind === 'work';
  const defaults = work
    ? {
        locale: normalizeLanguage(raw.original_language) ?? 'und',
        title: text(raw.title),
        description: text(raw.description),
      }
    : { locale: 'und', biography: text(raw.bio) };
  const incoming = [
    defaults,
    ...(Array.isArray(raw.texts) ? raw.texts.map(object) : []),
  ];
  for (const row of incoming) {
    const locale = importTextLocale(row.locale);
    const claim = work
      ? {
          title: text(row.title) ?? text(raw.title),
          description: text(row.description),
        }
      : { biography: text(row.biography) };
    if (!work && !claim.biography) continue;
    const current = work
      ? await tx.workText.findUnique({
          where: { workId_locale: { workId: id, locale } },
        })
      : await tx.authorText.findUnique({
          where: { authorId_locale: { authorId: id, locale } },
        });
    const prefix = `texts:${locale}:`;
    if (overrides.includes(`texts:${locale}`)) {
      conflicts.push(`texts:${locale}`);
      continue;
    }
    const patch = mergeMetadata(current, claim, conflicts, prefix, overrides);
    if (work)
      await tx.workText.upsert({
        where: { workId_locale: { workId: id, locale } },
        create: {
          workId: id,
          locale,
          title: claim.title!,
          description: claim.description,
        },
        update: patch,
      });
    else
      await tx.authorText.upsert({
        where: { authorId_locale: { authorId: id, locale } },
        create: { authorId: id, locale, biography: claim.biography! },
        update: patch,
      });
  }
}

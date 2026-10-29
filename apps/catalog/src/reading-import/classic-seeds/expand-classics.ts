import type { ClassicAuthor, ClassicLanguage, ClassicSeed } from './types';

export function expandClassics(
  language: ClassicLanguage,
  authors: readonly ClassicAuthor[],
): ClassicSeed[] {
  return authors.flatMap(({ titles, ...author }) =>
    titles.map((title) => ({
      ...author,
      language,
      title: typeof title === 'string' ? title : title[0],
      titleAliases: typeof title === 'string' ? [] : title.slice(1),
    })),
  );
}

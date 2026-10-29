import type { ClassicSeed } from './classic-seeds/types';

export function classicTitleVariants(classic: ClassicSeed): string[] {
  return [
    ...new Set(
      [classic.title, ...classic.titleAliases].flatMap((title) => [
        title,
        title.replace(/[’‘]/g, "'"),
        title.replace(/'/g, '’'),
      ]),
    ),
  ];
}

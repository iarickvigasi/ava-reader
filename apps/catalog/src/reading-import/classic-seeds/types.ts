export const CLASSIC_LANGUAGES = ['uk', 'en', 'de', 'fr', 'es', 'pl'] as const;
export type ClassicLanguage = (typeof CLASSIC_LANGUAGES)[number];

export type ClassicAuthor = {
  author: string;
  authorGender: 'woman' | 'man';
  authorAliases: readonly string[];
  authorDeathYear: number;
  bibliographyUrl: string;
  titles: readonly (string | readonly [string, ...string[]])[];
};

// Original-text discovery evidence, never clearance of an edition or its contributors.
export type ClassicSeed = Omit<ClassicAuthor, 'titles'> & {
  title: string;
  titleAliases: readonly string[];
  language: ClassicLanguage;
};

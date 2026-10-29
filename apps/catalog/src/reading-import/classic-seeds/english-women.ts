import { expandClassics } from './expand-classics';

export const ENGLISH_WOMEN = expandClassics('en', [
  {
    author: 'Mary Ann Evans (George Eliot)',
    authorGender: 'woman',
    authorAliases: ['George Eliot', 'Mary Ann Evans', 'Marian Evans'],
    authorDeathYear: 1880,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:George_Eliot',
    titles: [
      'Middlemarch',
      'The Mill on the Floss',
      'Silas Marner',
      'Adam Bede',
    ],
  },
  {
    author: 'Elizabeth Cleghorn Gaskell',
    authorGender: 'woman',
    authorAliases: ['Elizabeth Gaskell', 'Elizabeth Cleghorn Gaskell'],
    authorDeathYear: 1865,
    bibliographyUrl:
      'https://en.wikisource.org/wiki/Author:Elizabeth_Cleghorn_Gaskell',
    titles: ['North and South', 'Cranford', 'Mary Barton'],
  },
  {
    author: 'Louisa May Alcott',
    authorGender: 'woman',
    authorAliases: ['Louisa May Alcott'],
    authorDeathYear: 1888,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Louisa_May_Alcott',
    titles: ['Little Women', 'Little Men', 'Jo’s Boys'],
  },
  {
    author: 'Frances Eliza Hodgson Burnett',
    authorGender: 'woman',
    authorAliases: ['Frances Hodgson Burnett', 'Frances Eliza Hodgson Burnett'],
    authorDeathYear: 1924,
    bibliographyUrl:
      'https://en.wikisource.org/wiki/Author:Frances_Hodgson_Burnett',
    titles: ['The Secret Garden', 'A Little Princess'],
  },
]);

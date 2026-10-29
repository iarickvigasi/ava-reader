import { expandClassics } from './expand-classics';

export const ENGLISH_STORIES = expandClassics('en', [
  {
    author: 'Mary Wollstonecraft Shelley',
    authorGender: 'woman',
    authorAliases: ['Mary Shelley', 'Mary Wollstonecraft Shelley'],
    authorDeathYear: 1851,
    bibliographyUrl:
      'https://en.wikisource.org/wiki/Author:Mary_Wollstonecraft_Shelley',
    titles: [
      ['Frankenstein', 'Frankenstein; or, The Modern Prometheus'],
      'The Last Man',
      'Lodore',
    ],
  },
  {
    author: 'Abraham Stoker (Bram Stoker)',
    authorGender: 'man',
    authorAliases: ['Bram Stoker', 'Abraham Stoker'],
    authorDeathYear: 1912,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Bram_Stoker',
    titles: ['Dracula', 'The Lair of the White Worm'],
  },
  {
    author: 'Oscar Fingal O’Flahertie Wills Wilde',
    authorGender: 'man',
    authorAliases: ['Oscar Wilde'],
    authorDeathYear: 1900,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Oscar_Wilde',
    titles: ['The Picture of Dorian Gray', 'The Importance of Being Earnest'],
  },
  {
    author: 'Charles Lutwidge Dodgson (Lewis Carroll)',
    authorGender: 'man',
    authorAliases: ['Lewis Carroll', 'Charles Lutwidge Dodgson'],
    authorDeathYear: 1898,
    bibliographyUrl:
      'https://en.wikisource.org/wiki/Author:Charles_Lutwidge_Dodgson',
    titles: [
      'Alice’s Adventures in Wonderland',
      [
        'Through the Looking-Glass',
        'Through the Looking-Glass, and What Alice Found There',
      ],
    ],
  },
  {
    author: 'Robert Louis Balfour Stevenson',
    authorGender: 'man',
    authorAliases: ['Robert Louis Stevenson'],
    authorDeathYear: 1894,
    bibliographyUrl:
      'https://en.wikisource.org/wiki/Author:Robert_Louis_Stevenson',
    titles: [
      'Treasure Island',
      'Kidnapped',
      [
        'Strange Case of Dr Jekyll and Mr Hyde',
        'The Strange Case of Dr. Jekyll and Mr. Hyde',
      ],
    ],
  },
  {
    author: 'Edgar Allan Poe',
    authorGender: 'man',
    authorAliases: ['Edgar Allan Poe'],
    authorDeathYear: 1849,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Edgar_Allan_Poe',
    titles: [
      ['The Gold-Bug', 'The Gold Bug'],
      'The Fall of the House of Usher',
      'The Murders in the Rue Morgue',
    ],
  },
]);

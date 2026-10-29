import { expandClassics } from './expand-classics';

export const ENGLISH_NOVELS = expandClassics('en', [
  {
    author: 'Jane Austen',
    authorGender: 'woman',
    authorAliases: ['Jane Austen'],
    authorDeathYear: 1817,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Jane_Austen',
    titles: [
      'Pride and Prejudice',
      'Sense and Sensibility',
      'Emma',
      'Mansfield Park',
      'Persuasion',
      'Northanger Abbey',
    ],
  },
  {
    author: 'Charlotte Brontë',
    authorGender: 'woman',
    authorAliases: ['Charlotte Brontë', 'Charlotte Bronte', 'Currer Bell'],
    authorDeathYear: 1855,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Charlotte_Brontë',
    titles: ['Jane Eyre', 'Shirley', 'Villette'],
  },
  {
    author: 'Emily Jane Brontë',
    authorGender: 'woman',
    authorAliases: ['Emily Brontë', 'Emily Bronte', 'Ellis Bell'],
    authorDeathYear: 1848,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Emily_Jane_Brontë',
    titles: ['Wuthering Heights'],
  },
  {
    author: 'Charles John Huffam Dickens',
    authorGender: 'man',
    authorAliases: ['Charles Dickens'],
    authorDeathYear: 1870,
    bibliographyUrl:
      'https://en.wikisource.org/wiki/Author:Charles_John_Huffam_Dickens',
    titles: [
      'Great Expectations',
      'A Tale of Two Cities',
      'Oliver Twist',
      'David Copperfield',
      'Bleak House',
      'A Christmas Carol',
    ],
  },
  {
    author: 'Herman Melville',
    authorGender: 'man',
    authorAliases: ['Herman Melville'],
    authorDeathYear: 1891,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Herman_Melville',
    titles: [['Moby-Dick', 'Moby Dick'], 'Typee', 'Omoo'],
  },
  {
    author: 'Samuel Langhorne Clemens (Mark Twain)',
    authorGender: 'man',
    authorAliases: ['Mark Twain', 'Samuel Langhorne Clemens'],
    authorDeathYear: 1910,
    bibliographyUrl: 'https://en.wikisource.org/wiki/Author:Mark_Twain',
    titles: [
      'The Adventures of Tom Sawyer',
      ['Adventures of Huckleberry Finn', 'The Adventures of Huckleberry Finn'],
      'The Prince and the Pauper',
      'A Connecticut Yankee in King Arthur’s Court',
    ],
  },
]);

import { expandClassics } from './expand-classics';

export const FRENCH_WOMEN_NOVELS = expandClassics('fr', [
  {
    author: 'Amantine Aurore Lucile Dupin (George Sand)',
    authorGender: 'woman',
    authorAliases: ['George Sand', 'Aurore Dupin'],
    authorDeathYear: 1876,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:George_Sand',
    titles: [
      'La Mare au diable',
      'Indiana',
      'Lélia',
      'Valentine',
      'La Petite Fadette',
      'François le Champi',
      'Consuelo',
    ],
  },
  {
    author: 'Anne-Louise-Germaine Necker de Staël-Holstein',
    authorGender: 'woman',
    authorAliases: [
      'Germaine de Staël',
      'Germaine de Stael',
      'Madame de Staël',
    ],
    authorDeathYear: 1817,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:Madame_de_Staël',
    titles: [
      ['Corinne ou l’Italie', 'Corinne, ou l’Italie'],
      'Delphine',
      'De l’Allemagne',
    ],
  },
  {
    author: 'Marie-Madeleine Pioche de La Vergne (Madame de La Fayette)',
    authorGender: 'woman',
    authorAliases: [
      'Madame de La Fayette',
      'Madame de Lafayette',
      'Marie-Madeleine de La Fayette',
    ],
    authorDeathYear: 1693,
    bibliographyUrl:
      'https://fr.wikisource.org/wiki/Auteur:Madame_de_La_Fayette',
    titles: [
      'La Princesse de Clèves',
      'La Princesse de Montpensier',
      ['Zaïde', 'Zayde'],
    ],
  },
  {
    author: 'Marie-Jeanne Riccoboni',
    authorGender: 'woman',
    authorAliases: ['Marie-Jeanne Riccoboni', 'Madame Riccoboni'],
    authorDeathYear: 1792,
    bibliographyUrl:
      'https://fr.wikisource.org/wiki/Auteur:Marie-Jeanne_Riccoboni',
    titles: [
      [
        'Lettres de mistriss Fanni Butlerd',
        'Lettres de mistriss Fanni Butlerd, à milord Charles Alfred de Caitombridge',
      ],
      'Histoire de Monsieur le Marquis de Cressy',
      'Histoire d’Ernestine',
    ],
  },
]);

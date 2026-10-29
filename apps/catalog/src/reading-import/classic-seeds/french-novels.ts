import { expandClassics } from './expand-classics';

export const FRENCH_NOVELS = expandClassics('fr', [
  {
    author: 'Victor Marie Hugo',
    authorGender: 'man',
    authorAliases: ['Victor Hugo'],
    authorDeathYear: 1885,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:Victor_Hugo',
    titles: [
      'Les Misérables',
      'Notre-Dame de Paris',
      'Les Travailleurs de la mer',
      'L’Homme qui rit',
    ],
  },
  {
    author: 'Honoré de Balzac',
    authorGender: 'man',
    authorAliases: ['Honoré de Balzac', 'Honore de Balzac'],
    authorDeathYear: 1850,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:Honoré_de_Balzac',
    titles: [
      'Le Père Goriot',
      'Eugénie Grandet',
      'La Peau de chagrin',
      'Illusions perdues',
    ],
  },
  {
    author: 'Gustave Flaubert',
    authorGender: 'man',
    authorAliases: ['Gustave Flaubert'],
    authorDeathYear: 1880,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:Gustave_Flaubert',
    titles: ['Madame Bovary', 'Salammbô', 'L’Éducation sentimentale'],
  },
  {
    author: 'Jules Gabriel Verne',
    authorGender: 'man',
    authorAliases: ['Jules Verne'],
    authorDeathYear: 1905,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:Jules_Verne',
    titles: [
      'Voyage au centre de la Terre',
      'Vingt mille lieues sous les mers',
      'Le Tour du monde en quatre-vingts jours',
      'L’Île mystérieuse',
    ],
  },
]);

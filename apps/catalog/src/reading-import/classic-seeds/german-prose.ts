import { expandClassics } from './expand-classics';

export const GERMAN_PROSE = expandClassics('de', [
  {
    author: 'Ernst Theodor Amadeus Hoffmann',
    authorGender: 'man',
    authorAliases: [
      'E. T. A. Hoffmann',
      'E.T.A. Hoffmann',
      'Ernst Theodor Wilhelm Hoffmann',
    ],
    authorDeathYear: 1822,
    bibliographyUrl: 'https://de.wikisource.org/wiki/E._T._A._Hoffmann',
    titles: [
      'Der Sandmann',
      ['Der goldne Topf', 'Der goldene Topf'],
      'Die Elixiere des Teufels',
    ],
  },
  {
    author: 'Heinrich Theodor Fontane',
    authorGender: 'man',
    authorAliases: ['Theodor Fontane', 'Fontane'],
    authorDeathYear: 1898,
    bibliographyUrl: 'https://de.wikisource.org/wiki/Theodor_Fontane',
    titles: ['Effi Briest', 'Irrungen, Wirrungen', 'Der Stechlin'],
  },
  {
    author: 'Hans Theodor Woldsen Storm',
    authorGender: 'man',
    authorAliases: ['Theodor Storm', 'Storm'],
    authorDeathYear: 1888,
    bibliographyUrl: 'https://de.wikisource.org/wiki/Theodor_Storm',
    titles: ['Der Schimmelreiter', 'Immensee', 'Aquis submersus'],
  },
  {
    author: 'Gottfried Keller',
    authorGender: 'man',
    authorAliases: ['Gottfried Keller'],
    authorDeathYear: 1890,
    bibliographyUrl: 'https://de.wikisource.org/wiki/Gottfried_Keller',
    titles: ['Der grüne Heinrich', 'Kleider machen Leute'],
  },
  {
    author: 'Christian Johann Heinrich Heine',
    authorGender: 'man',
    authorAliases: ['Heinrich Heine', 'Heine'],
    authorDeathYear: 1856,
    bibliographyUrl: 'https://de.wikisource.org/wiki/Heinrich_Heine',
    titles: [
      'Die Harzreise',
      ['Deutschland. Ein Wintermärchen', 'Deutschland, ein Wintermärchen'],
    ],
  },
]);

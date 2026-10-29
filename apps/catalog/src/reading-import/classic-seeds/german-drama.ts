import { expandClassics } from './expand-classics';

export const GERMAN_DRAMA = expandClassics('de', [
  {
    author: 'Johann Wolfgang von Goethe',
    authorGender: 'man',
    authorAliases: ['Goethe'],
    authorDeathYear: 1832,
    bibliographyUrl:
      'https://de.wikisource.org/wiki/Johann_Wolfgang_von_Goethe',
    titles: [
      ['Faust', 'Faust. Eine Tragödie', 'Faust I'],
      'Die Leiden des jungen Werthers',
      'Wilhelm Meisters Lehrjahre',
      'Die Wahlverwandtschaften',
      'Iphigenie auf Tauris',
    ],
  },
  {
    author: 'Johann Christoph Friedrich von Schiller',
    authorGender: 'man',
    authorAliases: ['Friedrich Schiller', 'Schiller'],
    authorDeathYear: 1805,
    bibliographyUrl: 'https://de.wikisource.org/wiki/Friedrich_Schiller',
    titles: [
      'Die Räuber',
      'Kabale und Liebe',
      ['Don Karlos', 'Don Carlos'],
      'Wilhelm Tell',
    ],
  },
  {
    author: 'Bernd Heinrich Wilhelm von Kleist',
    authorGender: 'man',
    authorAliases: ['Heinrich von Kleist', 'Kleist'],
    authorDeathYear: 1811,
    bibliographyUrl: 'https://de.wikisource.org/wiki/Heinrich_von_Kleist',
    titles: [
      'Michael Kohlhaas',
      ['Der zerbrochne Krug', 'Der zerbrochene Krug'],
      'Penthesilea',
    ],
  },
]);

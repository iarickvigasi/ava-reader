import { expandClassics } from './expand-classics';

export const POLISH_REALIST = expandClassics('pl', [
  {
    author: 'Henryk Adam Aleksander Pius Sienkiewicz',
    authorGender: 'man',
    authorAliases: ['Henryk Sienkiewicz'],
    authorDeathYear: 1916,
    bibliographyUrl:
      'https://wolnelektury.pl/katalog/autor/henryk-sienkiewicz/',
    titles: [
      'Quo vadis',
      'Ogniem i mieczem',
      'Potop',
      'Pan Wołodyjowski',
      'Krzyżacy',
    ],
  },
  {
    author: 'Aleksander Głowacki (Bolesław Prus)',
    authorGender: 'man',
    authorAliases: ['Bolesław Prus', 'Boleslaw Prus', 'Aleksander Głowacki'],
    authorDeathYear: 1912,
    bibliographyUrl: 'https://wolnelektury.pl/katalog/autor/boleslaw-prus/',
    titles: ['Lalka', 'Faraon', 'Placówka', 'Kamizelka', 'Katarynka'],
  },
  {
    author: 'Eliza Orzeszkowa',
    authorGender: 'woman',
    authorAliases: ['Eliza Orzeszkowa'],
    authorDeathYear: 1910,
    bibliographyUrl: 'https://wolnelektury.pl/katalog/autor/eliza-orzeszkowa/',
    titles: [
      'Nad Niemnem',
      'Cham',
      'Marta',
      'Dziurdziowie',
      ['A...B...C...', 'A…B…C…'],
      'Gloria victis',
      'Meir Ezofowicz',
    ],
  },
  {
    author: 'Maria Stanisława Konopnicka',
    authorGender: 'woman',
    authorAliases: ['Maria Konopnicka'],
    authorDeathYear: 1910,
    bibliographyUrl: 'https://wolnelektury.pl/katalog/autor/maria-konopnicka/',
    titles: [
      'Nasza szkapa',
      'Mendel Gdański',
      'O krasnoludkach i o sierotce Marysi',
      'Dym',
      'Na jagody',
      'Miłosierdzie gminy',
      'Urbanowa',
    ],
  },
]);

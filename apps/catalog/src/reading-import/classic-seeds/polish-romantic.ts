import { expandClassics } from './expand-classics';

export const POLISH_ROMANTIC = expandClassics('pl', [
  {
    author: 'Adam Bernard Mickiewicz',
    authorGender: 'man',
    authorAliases: ['Adam Mickiewicz'],
    authorDeathYear: 1855,
    bibliographyUrl: 'https://wolnelektury.pl/katalog/autor/adam-mickiewicz/',
    titles: [
      'Pan Tadeusz',
      'Dziady',
      'Konrad Wallenrod',
      'Grażyna',
      'Ballady i romanse',
    ],
  },
  {
    author: 'Juliusz Słowacki',
    authorGender: 'man',
    authorAliases: ['Juliusz Słowacki', 'Juliusz Slowacki'],
    authorDeathYear: 1849,
    bibliographyUrl: 'https://wolnelektury.pl/katalog/autor/juliusz-slowacki/',
    titles: ['Kordian', 'Balladyna', 'Lilla Weneda', 'Beniowski'],
  },
  {
    author: 'Aleksander Fredro',
    authorGender: 'man',
    authorAliases: ['Aleksander Fredro'],
    authorDeathYear: 1876,
    bibliographyUrl: 'https://wolnelektury.pl/katalog/autor/aleksander-fredro/',
    titles: [
      'Zemsta',
      ['Śluby panieńskie', 'Śluby panieńskie czyli Magnetyzm serca'],
      'Pan Jowialski',
      'Damy i huzary',
    ],
  },
  {
    author: 'Napoleon Stanisław Adam Feliks Zygmunt Krasiński',
    authorGender: 'man',
    authorAliases: ['Zygmunt Krasiński', 'Zygmunt Krasinski'],
    authorDeathYear: 1859,
    bibliographyUrl: 'https://wolnelektury.pl/katalog/autor/zygmunt-krasinski/',
    titles: ['Nie-Boska komedia', 'Irydion'],
  },
]);

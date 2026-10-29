import { expandClassics } from './expand-classics';

export const UKRAINIAN = expandClassics('uk', [
  {
    author: 'Іван Петрович Котляревський',
    authorGender: 'man',
    authorAliases: [
      'Іван Котляревський',
      'Ivan Kotliarevsky',
      'Ivan Kotlyarevsky',
    ],
    authorDeathYear: 1838,
    bibliographyUrl: 'https://uk.wikisource.org/wiki/Автор:Іван_Котляревський',
    titles: [
      ['Енеїда', 'Eneida'],
      ['Наталка Полтавка', 'Natalka Poltavka'],
      'Москаль-чарівник',
    ],
  },
  {
    author: 'Тарас Григорович Шевченко',
    authorGender: 'man',
    authorAliases: ['Тарас Шевченко', 'Taras Shevchenko'],
    authorDeathYear: 1861,
    bibliographyUrl: 'https://uk.wikisource.org/wiki/Автор:Тарас_Шевченко',
    titles: [
      ['Кобзар', 'Kobzar'],
      ['Гайдамаки', 'Haidamaky', 'Haydamaky'],
      'Катерина',
      'Наймичка',
      'Гамалія',
      'Назар Стодоля',
      'Сон',
      'Неофіти',
    ],
  },
  {
    author: 'Григорій Федорович Квітка-Основ’яненко',
    authorGender: 'man',
    authorAliases: [
      "Григорій Квітка-Основ'яненко",
      'Hryhorii Kvitka',
      'Grigory Kvitka',
    ],
    authorDeathYear: 1843,
    bibliographyUrl:
      'https://uk.wikisource.org/wiki/Автор:Григорій_Квітка-Основ%27яненко',
    titles: [
      ['Маруся', 'Marusia', 'Marusya'],
      ['Конотопська відьма', 'The Witch of Konotop'],
      'Перекотиполе',
    ],
  },
  {
    author: 'Пантелеймон Олександрович Куліш',
    authorGender: 'man',
    authorAliases: [
      'Пантелеймон Куліш',
      'Panteleimon Kulish',
      'Panteleymon Kulish',
    ],
    authorDeathYear: 1897,
    bibliographyUrl: 'https://uk.wikisource.org/wiki/Автор:Пантелеймон_Куліш',
    titles: [
      ['Чорна рада', 'Chorna rada', 'The Black Council'],
      ['Досвітки', 'Dosvitky'],
      'Орися',
      'Дівоче серце',
      'Мартин Гак',
      'Огняний змій',
      'Хуторна поезія',
      ['Дзвін', 'Дзьвін'],
      'Байда, князь Вишневецький',
      'Цар Наливай',
      'Петро Сагайдашний',
    ],
  },
]);

import { expandClassics } from './expand-classics';

export const SPANISH_POETRY = expandClassics('es', [
  {
    author: 'José de Espronceda y Delgado',
    authorGender: 'man',
    authorAliases: ['José de Espronceda', 'Jose de Espronceda'],
    authorDeathYear: 1842,
    bibliographyUrl: 'https://es.wikisource.org/wiki/Autor:José_de_Espronceda',
    titles: ['El estudiante de Salamanca', 'El diablo mundo'],
  },
  {
    author: 'José Cadalso y Vázquez de Andrade',
    authorGender: 'man',
    authorAliases: ['José Cadalso', 'Jose Cadalso'],
    authorDeathYear: 1782,
    bibliographyUrl: 'https://es.wikisource.org/wiki/Autor:José_Cadalso',
    titles: ['Cartas marruecas', 'Noches lúgubres'],
  },
  {
    author: 'Cecilia Böhl de Faber y Ruiz de Larrea (Fernán Caballero)',
    authorGender: 'woman',
    authorAliases: [
      'Fernán Caballero',
      'Fernan Caballero',
      'Cecilia Böhl de Faber',
    ],
    authorDeathYear: 1877,
    bibliographyUrl: 'https://es.wikisource.org/wiki/Autor:Fernán_Caballero',
    titles: ['La gaviota', 'Clemencia'],
  },
]);

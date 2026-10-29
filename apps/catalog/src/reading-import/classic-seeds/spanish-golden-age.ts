import { expandClassics } from './expand-classics';

export const SPANISH_GOLDEN_AGE = expandClassics('es', [
  {
    author: 'Miguel de Cervantes Saavedra',
    authorGender: 'man',
    authorAliases: ['Miguel de Cervantes', 'Cervantes'],
    authorDeathYear: 1616,
    bibliographyUrl: 'https://es.wikisource.org/wiki/Autor:Miguel_de_Cervantes',
    titles: [
      [
        'Don Quijote de la Mancha',
        'Don Quixote',
        'El ingenioso hidalgo don Quijote de la Mancha',
      ],
      'Novelas ejemplares',
      'La Galatea',
      'Los trabajos de Persiles y Sigismunda',
    ],
  },
  {
    author: 'Félix Lope de Vega y Carpio',
    authorGender: 'man',
    authorAliases: ['Lope de Vega'],
    authorDeathYear: 1635,
    bibliographyUrl: 'https://es.wikisource.org/wiki/Autor:Lope_de_Vega',
    titles: [
      ['Fuenteovejuna', 'Fuente Ovejuna'],
      'Peribáñez y el comendador de Ocaña',
      'El caballero de Olmedo',
      'El perro del hortelano',
    ],
  },
  {
    author: 'Pedro Calderón de la Barca',
    authorGender: 'man',
    authorAliases: ['Calderón de la Barca', 'Calderon de la Barca'],
    authorDeathYear: 1681,
    bibliographyUrl:
      'https://es.wikisource.org/wiki/Autor:Pedro_Calderón_de_la_Barca',
    titles: ['La vida es sueño', 'El alcalde de Zalamea', 'La dama duende'],
  },
  {
    author: 'Francisco Gómez de Quevedo Villegas',
    authorGender: 'man',
    authorAliases: ['Francisco de Quevedo', 'Quevedo'],
    authorDeathYear: 1645,
    bibliographyUrl:
      'https://es.wikisource.org/wiki/Autor:Francisco_de_Quevedo',
    titles: [
      ['El Buscón', 'Historia de la vida del Buscón'],
      'Sueños y discursos',
    ],
  },
]);

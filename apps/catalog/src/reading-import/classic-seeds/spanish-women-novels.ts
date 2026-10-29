import { expandClassics } from './expand-classics';

export const SPANISH_WOMEN_NOVELS = expandClassics('es', [
  {
    author: 'Emilia Pardo Bazán y de la Rúa',
    authorGender: 'woman',
    authorAliases: ['Emilia Pardo Bazán', 'Emilia Pardo Bazan'],
    authorDeathYear: 1921,
    bibliographyUrl: 'https://es.wikisource.org/wiki/Autor:Emilia_Pardo_Bazán',
    titles: [
      'Los pazos de Ulloa',
      'La madre naturaleza',
      'La tribuna',
      'Insolación',
    ],
  },
  {
    author: 'Gertrudis Gómez de Avellaneda y Arteaga',
    authorGender: 'woman',
    authorAliases: [
      'Gertrudis Gómez de Avellaneda',
      'Gertrudis Gomez de Avellaneda',
    ],
    authorDeathYear: 1873,
    bibliographyUrl:
      'https://es.wikisource.org/wiki/Autor:Gertrudis_Gómez_de_Avellaneda',
    titles: ['Sab', 'Dos mujeres', 'La hija de las flores'],
  },
  {
    author: 'Carolina Coronado Romero de Tejada',
    authorGender: 'woman',
    authorAliases: ['Carolina Coronado'],
    authorDeathYear: 1911,
    bibliographyUrl: 'https://es.wikisource.org/wiki/Autor:Carolina_Coronado',
    titles: [['Jarilla', 'Jarrilla'], 'Paquita'],
  },
  {
    author: 'María de Zayas y Sotomayor',
    authorGender: 'woman',
    authorAliases: ['María de Zayas', 'Maria de Zayas'],
    authorDeathYear: 1661, // Approximate; the source marks the date as uncertain.
    bibliographyUrl:
      'https://es.wikisource.org/wiki/Autor:María_de_Zayas_y_Sotomayor',
    titles: ['Novelas amorosas y ejemplares', 'Desengaños amorosos'],
  },
  {
    author: 'Clorinda Matto de Turner',
    authorGender: 'woman',
    authorAliases: ['Clorinda Matto de Turner'],
    authorDeathYear: 1909,
    bibliographyUrl:
      'https://es.wikisource.org/wiki/Autor:Clorinda_Matto_de_Turner',
    titles: ['Aves sin nido', 'Índole', 'Herencia'],
  },
]);

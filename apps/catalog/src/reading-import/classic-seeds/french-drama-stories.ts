import { expandClassics } from './expand-classics';

export const FRENCH_DRAMA_STORIES = expandClassics('fr', [
  {
    author: 'Henry René Albert Guy de Maupassant',
    authorGender: 'man',
    authorAliases: ['Guy de Maupassant', 'Maupassant'],
    authorDeathYear: 1893,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:Guy_de_Maupassant',
    titles: ['Bel-Ami', 'Une vie', 'Pierre et Jean', 'Boule de suif'],
  },
  {
    author: 'Marie-Henri Beyle (Stendhal)',
    authorGender: 'man',
    authorAliases: ['Stendhal', 'Henri Beyle'],
    authorDeathYear: 1842,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:Stendhal',
    titles: ['Le Rouge et le Noir', 'La Chartreuse de Parme'],
  },
  {
    author: 'Jean-Baptiste Poquelin (Molière)',
    authorGender: 'man',
    authorAliases: ['Molière', 'Moliere', 'Jean-Baptiste Poquelin'],
    authorDeathYear: 1673,
    bibliographyUrl: 'https://fr.wikisource.org/wiki/Auteur:Molière',
    titles: [
      ['Le Tartuffe', 'Tartuffe', 'Le Tartuffe ou l’Imposteur'],
      'Le Misanthrope',
      'L’Avare',
      'Le Malade imaginaire',
    ],
  },
]);

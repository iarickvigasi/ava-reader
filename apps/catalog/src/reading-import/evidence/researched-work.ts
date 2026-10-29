import uk from '../../../data/classics-rights/uk.json';
import en from '../../../data/classics-rights/en.json';
import de from '../../../data/classics-rights/de.json';
import fr from '../../../data/classics-rights/fr.json';
import es from '../../../data/classics-rights/es.json';
import pl from '../../../data/classics-rights/pl.json';
import rules from '../../../data/classics-rights/rules.json';
import { CLASSICS } from '../classics';
import type { Candidate } from '../types';
const books = [
  ...uk.books,
  ...en.books,
  ...de.books,
  ...fr.books,
  ...es.books,
  ...pl.books,
];
export function researchedWork(candidate: Candidate) {
  const seed = CLASSICS.find(
    (seed) =>
      seed.language === candidate.language &&
      [seed.title, ...seed.titleAliases].includes(candidate.title) &&
      candidate.authors.some((author) =>
        [seed.author, ...seed.authorAliases].includes(author),
      ),
  );
  const book =
    seed &&
    books.find(
      (book) =>
        book.language === seed.language &&
        book.title === seed.title &&
        book.author === seed.author,
    );
  if (!book) return null;
  return {
    ...book.originalTextResearch,
    publicationPolicy: book.publicationPolicy,
    author: book.author,
    title: book.title,
    researchedAt: rules.asOf,
    rules: book.originalTextResearch.ruleRefs.map((id) => ({
      id,
      ...rules.rules[id as keyof typeof rules.rules],
    })),
  };
}

import { interleaveClassics } from './classic-seeds/interleave-classics';
import { POLISH_WOMEN } from './classic-seeds/polish-women';
import { SPANISH_WOMEN_POETRY } from './classic-seeds/spanish-women-poetry';
import { SPANISH_WOMEN_NOVELS } from './classic-seeds/spanish-women-novels';
import { FRENCH_WOMEN_LETTERS } from './classic-seeds/french-women-letters';
import { FRENCH_WOMEN_NOVELS } from './classic-seeds/french-women-novels';
import { GERMAN_WOMEN_ROMANTIC } from './classic-seeds/german-women-romantic';
import { GERMAN_WOMEN_PROSE } from './classic-seeds/german-women-prose';
import { ENGLISH_WOMEN } from './classic-seeds/english-women';
import { UKRAINIAN_WOMEN } from './classic-seeds/ukrainian-women';
import { ENGLISH_NOVELS } from './classic-seeds/english-novels';
import { ENGLISH_STORIES } from './classic-seeds/english-stories';
import { FRENCH_NOVELS } from './classic-seeds/french-novels';
import { FRENCH_DRAMA_STORIES } from './classic-seeds/french-drama-stories';
import { GERMAN_DRAMA } from './classic-seeds/german-drama';
import { GERMAN_PROSE } from './classic-seeds/german-prose';
import { POLISH_ROMANTIC } from './classic-seeds/polish-romantic';
import { POLISH_REALIST } from './classic-seeds/polish-realist';
import { SPANISH_GOLDEN_AGE } from './classic-seeds/spanish-golden-age';
import { SPANISH_ROMANTIC_PROSE } from './classic-seeds/spanish-romantic-prose';
import { SPANISH_POETRY } from './classic-seeds/spanish-poetry';
import { UKRAINIAN } from './classic-seeds/ukrainian';

// Interleave languages and women/men works so bounded batches discover both early.
// Evidence concerns original texts only; edition rights and file quality still need review.
const languages = [
  [...UKRAINIAN, ...UKRAINIAN_WOMEN],
  [...ENGLISH_NOVELS, ...ENGLISH_STORIES, ...ENGLISH_WOMEN],
  [
    ...GERMAN_DRAMA,
    ...GERMAN_PROSE,
    ...GERMAN_WOMEN_PROSE,
    ...GERMAN_WOMEN_ROMANTIC,
  ],
  [
    ...FRENCH_NOVELS,
    ...FRENCH_DRAMA_STORIES,
    ...FRENCH_WOMEN_NOVELS,
    ...FRENCH_WOMEN_LETTERS,
  ],
  [
    ...SPANISH_GOLDEN_AGE,
    ...SPANISH_ROMANTIC_PROSE,
    ...SPANISH_POETRY,
    ...SPANISH_WOMEN_NOVELS,
    ...SPANISH_WOMEN_POETRY,
  ],
  [...POLISH_ROMANTIC, ...POLISH_REALIST, ...POLISH_WOMEN],
];
export const CLASSICS = interleaveClassics(
  languages.map((seeds) =>
    interleaveClassics([
      seeds.filter((seed) => seed.authorGender === 'man'),
      seeds.filter((seed) => seed.authorGender === 'woman'),
    ]),
  ),
);

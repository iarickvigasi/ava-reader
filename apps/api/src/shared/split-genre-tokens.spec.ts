import { splitGenreTokens } from './split-genre-tokens';

it.each([
  [
    '1. Interpersonal communication. 2. Interpersonal relations. 3. Nonviolence.',
    ['Interpersonal communication', 'Interpersonal relations', 'Nonviolence'],
  ],
  [
    ' 1. Fiction  2. Self-Help. 10. History. ',
    ['Fiction', 'Self-Help', 'History'],
  ],
  [
    '1. Fiction,Fantasy. 2. History - General.',
    ['Fiction', 'Fantasy', 'History', 'General'],
  ],
  [
    'U.S. history, Web 2.0, 19th century',
    ['U.S. history', 'Web 2.0', '19th century'],
  ],
  ['Part 2. History', ['Part 2. History']],
  ['Fiction -- Classic, , Self-Help', ['Fiction', 'Classic', 'Self-Help']],
])('splits genre subject %s', (subject, expected) => {
  expect(splitGenreTokens(subject)).toEqual(expected);
});

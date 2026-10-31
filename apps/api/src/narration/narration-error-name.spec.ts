import { narrationErrorName } from './narration-error-name';

it('recognizes native timeout exceptions without relying on their realm', () => {
  expect(
    narrationErrorName(new DOMException('Timed out', 'TimeoutError')),
  ).toBe('TimeoutError');
});
it.each([
  null,
  'private passage',
  { name: 'private passage', message: 'secret' },
  { message: 'TimeoutError' },
])('does not expose unrecognized thrown data', (error) => {
  expect(narrationErrorName(error)).toBe('UnknownError');
});

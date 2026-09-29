import { dayKey, splitReadingDays } from './reading-days';

const cases = [
  [
    'Europe/Belgrade',
    '2026-09-25T00:10:00+02:00',
    '2026-09-25T00:50:00+02:00',
    [['2026-09-25', 2400]],
  ],
  [
    'Europe/Belgrade',
    '2026-09-24T23:40:00+02:00',
    '2026-09-25T00:30:00+02:00',
    [
      ['2026-09-24', 1200],
      ['2026-09-25', 1800],
    ],
  ],
  [
    'Europe/Belgrade',
    '2026-03-29T00:00:00+01:00',
    '2026-03-30T00:00:00+02:00',
    [['2026-03-29', 82800]],
  ],
  [
    'Europe/Belgrade',
    '2026-10-25T00:00:00+02:00',
    '2026-10-26T00:00:00+01:00',
    [['2026-10-25', 90000]],
  ],
  [
    'America/Los_Angeles',
    '2026-09-25T06:40:00Z',
    '2026-09-25T07:30:00Z',
    [
      ['2026-09-24', 1200],
      ['2026-09-25', 1800],
    ],
  ],
  [
    'Asia/Kathmandu',
    '2026-09-24T18:00:00Z',
    '2026-09-24T18:30:00Z',
    [
      ['2026-09-24', 900],
      ['2026-09-25', 900],
    ],
  ],
] as const;

it.each(cases)(
  'splits credited time in %s from %s to %s',
  (zone, start, end, expected) => {
    const days = splitReadingDays(Date.parse(start), Date.parse(end), zone);
    expect([...days]).toEqual(expected);
    expect([...days.values()].reduce((sum, n) => sum + n, 0)).toBe(
      (Date.parse(end) - Date.parse(start)) / 1000,
    );
  },
);

it('uses Friday at the screenshot instant and Thursday when viewed in Los Angeles', () => {
  const now = new Date('2026-09-25T00:58:00+02:00');
  expect(dayKey(now, 'Europe/Belgrade')).toBe('2026-09-25');
  expect(dayKey(now, 'America/Los_Angeles')).toBe('2026-09-24');
});

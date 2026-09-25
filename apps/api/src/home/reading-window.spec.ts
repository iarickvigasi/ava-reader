import { readingWindow } from './reading-window';
import { readingWindowData } from './reading-window-data';

afterEach(() => jest.useRealTimers());
it('selects the local week, reassigns exact time and retains uncovered legacy seconds', () => {
  jest.useFakeTimers().setSystemTime(Date.parse('2026-09-24T22:58:00Z'));
  const window = readingWindow('Europe/Belgrade');
  expect(window.keys.at(-1)).toBe('2026-09-25');
  const result = readingWindowData(
    [{ trackedDay: new Date('2026-09-24T00:00:00Z'), durationSeconds: 3000 }],
    [
      {
        startedAt: new Date('2026-09-24T22:10:00Z'),
        endedAt: new Date('2026-09-24T22:50:00Z'),
        timeZone: 'Europe/Belgrade',
      },
    ],
    window,
    'Europe/Belgrade',
  );
  expect(result.legacyDays).toEqual([{ key: '2026-09-24', seconds: 600 }]);
  expect(result.days.slice(-2)).toEqual([
    { key: '2026-09-24', seconds: 600 },
    { key: '2026-09-25', seconds: 2400 },
  ]);
  expect(result.version).toBe(3);
});
it('clips long intervals to the UTC buffer before subtracting covered segments', () => {
  const window = {
    start: new Date('2026-09-24T00:00:00Z'),
    end: new Date('2026-09-25T00:00:00Z'),
    keys: ['2026-09-24'],
  };
  const result = readingWindowData(
    [{ trackedDay: window.start, durationSeconds: 86400 }],
    [
      {
        startedAt: new Date('2026-09-23T23:00:00Z'),
        endedAt: new Date('2026-09-25T01:00:00Z'),
      },
    ],
    window,
    'UTC',
  );
  expect(result.legacyDays).toEqual([]);
  expect(result.days[0].seconds).toBe(86400);
});
it('validates timezone and exclusive calendar cursors', () => {
  expect(() => readingWindow('invalid/zone')).toThrow('timeZone');
  expect(() => readingWindow('UTC', '2026-02-30')).toThrow('before');
  expect(readingWindow('Asia/Kathmandu', '2026-03-01').keys).toEqual([
    '2026-02-22',
    '2026-02-23',
    '2026-02-24',
    '2026-02-25',
    '2026-02-26',
    '2026-02-27',
    '2026-02-28',
  ]);
});

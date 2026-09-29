import { readingWindow } from './reading-window';
import { readingWindowData } from './reading-window-data';

it('keeps each session on its original local day for viewers in different zones', () => {
  const segments = [
    { trackedDay: new Date('2026-09-24T00:00:00Z'), durationSeconds: 2400 },
  ];
  const interval = {
    startedAt: new Date('2026-09-24T22:10:00Z'),
    endedAt: new Date('2026-09-24T22:50:00Z'),
    timeZone: 'Europe/Belgrade',
  };
  for (const viewer of ['Europe/Belgrade', 'America/Los_Angeles']) {
    const result = readingWindowData(
      segments,
      [interval],
      readingWindow(viewer, '2026-09-26'),
      viewer,
    );
    expect(result.days.at(-1)).toEqual({ key: '2026-09-25', seconds: 2400 });
    expect(result.days.at(-2)?.seconds).toBe(0);
  }
  const unknown = readingWindowData(
    segments,
    [{ ...interval, timeZone: null }],
    readingWindow('Europe/Belgrade', '2026-09-26'),
    'Europe/Belgrade',
  );
  expect(unknown.days.at(-2)).toEqual({ key: '2026-09-24', seconds: 2400 });
  expect(unknown.days.at(-1)?.seconds).toBe(0);
});

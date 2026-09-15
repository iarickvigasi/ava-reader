import { createMasteryPayload } from './mastery-payload';

describe('createMasteryPayload', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-03T12:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fills seven chronological days through today across month boundaries', () => {
    const mastery = createMasteryPayload([]);

    expect(mastery).toEqual({
      dailyGoalMinutes: 60,
      days: [
        '2026-08-28',
        '2026-08-29',
        '2026-08-30',
        '2026-08-31',
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
      ].map((key) => ({ goalMet: false, key, minutes: 0 })),
      remainingMinutes: 60,
      todayMinutes: 0,
    });
  });

  it('aggregates seconds within a UTC day before flooring to whole minutes', () => {
    const mastery = createMasteryPayload([
      { durationSeconds: 29, trackedDay: new Date('2026-09-03T00:00:00Z') },
      { durationSeconds: 31, trackedDay: new Date('2026-09-03T12:00:00Z') },
      { durationSeconds: 59, trackedDay: new Date('2026-09-03T23:59:59Z') },
      { durationSeconds: 60, trackedDay: new Date('2026-08-28T00:00:00Z') },
      { durationSeconds: 60, trackedDay: new Date('2026-08-27T23:59:59Z') },
      { durationSeconds: 60, trackedDay: new Date('2026-09-04T00:00:00Z') },
    ]);

    expect(mastery.days.map((day) => day.minutes)).toEqual([
      1, 0, 0, 0, 0, 0, 1,
    ]);
    expect(mastery.todayMinutes).toBe(1);
    expect(mastery.remainingMinutes).toBe(59);
  });

  it.each([
    [3_599, 59, false, 1],
    [3_600, 60, true, 0],
    [3_900, 65, true, 0],
  ])(
    'calculates goal progress for %i reading seconds',
    (durationSeconds, minutes, goalMet, remainingMinutes) => {
      const mastery = createMasteryPayload([
        { durationSeconds, trackedDay: new Date('2026-09-03T00:00:00Z') },
      ]);

      expect(mastery.days.at(-1)).toEqual({
        goalMet,
        key: '2026-09-03',
        minutes,
      });
      expect(mastery.todayMinutes).toBe(minutes);
      expect(mastery.remainingMinutes).toBe(remainingMinutes);
    },
  );

  it.each([
    [1_799, 29, false, 1],
    [1_800, 30, true, 0],
    [2_100, 35, true, 0],
  ])(
    'calculates a custom 30-minute goal for %i reading seconds',
    (durationSeconds, minutes, goalMet, remainingMinutes) => {
      const mastery = createMasteryPayload(
        [{ durationSeconds, trackedDay: new Date('2026-09-03T00:00:00Z') }],
        30,
      );

      expect(mastery.dailyGoalMinutes).toBe(30);
      expect(mastery.days.at(-1)).toEqual({
        goalMet,
        key: '2026-09-03',
        minutes,
      });
      expect(mastery.todayMinutes).toBe(minutes);
      expect(mastery.remainingMinutes).toBe(remainingMinutes);
    },
  );
});

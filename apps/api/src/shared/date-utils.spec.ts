import { daysAgo, startOfDay } from './date-utils';

describe('daysAgo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-21T14:30:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a date N days in the past', () => {
    const result = daysAgo(2);
    expect(result.toISOString()).toBe('2026-04-19T14:30:00.000Z');
  });

  it('returns today when days is 0', () => {
    const result = daysAgo(0);
    expect(result.toISOString()).toBe('2026-04-21T14:30:00.000Z');
  });

  it('returns a stable date value', () => {
    const a = daysAgo(5);
    const b = daysAgo(5);
    expect(a.getTime()).toBe(b.getTime());
  });
});

describe('startOfDay', () => {
  it('floors a UTC date to the start of its UTC day', () => {
    const input = new Date('2026-04-21T14:30:45.123Z');
    const result = startOfDay(input);
    expect(result.toISOString()).toBe('2026-04-21T00:00:00.000Z');
  });

  it('returns UTC midnight for a UTC-midnight input', () => {
    const input = new Date('2026-04-21T00:00:00.000Z');
    const result = startOfDay(input);
    expect(result.toISOString()).toBe('2026-04-21T00:00:00.000Z');
  });

  it('returns UTC midnight for a just-before-midnight input', () => {
    const input = new Date('2026-04-21T23:59:59.999Z');
    const result = startOfDay(input);
    expect(result.toISOString()).toBe('2026-04-21T00:00:00.000Z');
  });

  it('handles month boundaries', () => {
    const input = new Date('2026-03-31T12:00:00.000Z');
    const result = startOfDay(input);
    expect(result.toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });
});

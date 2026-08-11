import { countsTowardReading, tripsAggregateGuard } from './policy';

describe('countsTowardReading', () => {
  it.each(['BODY', 'PREFACE', 'AFTERWORD', 'UNKNOWN'] as const)(
    'counts %s',
    (purpose) => {
      expect(countsTowardReading({ confidence: 'high', purpose })).toBe(true);
    },
  );

  it.each(['NOTES', 'REFERENCES', 'TOC', 'INDEX', 'FRONT_MATTER'] as const)(
    'excludes %s',
    (purpose) => {
      expect(countsTowardReading({ confidence: 'high', purpose })).toBe(false);
    },
  );

  // Over-counting lands on the pre-analysis estimate; under-counting invents a
  // wrong number. The tie goes to counting.
  it('counts a low-confidence chapter whatever it was labelled', () => {
    expect(countsTowardReading({ confidence: 'low', purpose: 'INDEX' })).toBe(
      true,
    );
  });
});

describe('tripsAggregateGuard', () => {
  it('passes when body dominates', () => {
    expect(
      tripsAggregateGuard([
        { counted: true, wordCount: 9_000 },
        { counted: false, wordCount: 800 },
      ]),
    ).toBe(false);
  });

  it('trips when counted words fall under 40%', () => {
    expect(
      tripsAggregateGuard([
        { counted: true, wordCount: 3_000 },
        { counted: false, wordCount: 7_000 },
      ]),
    ).toBe(true);
  });

  it('trips on an empty book rather than dividing by zero', () => {
    expect(tripsAggregateGuard([{ counted: true, wordCount: 0 }])).toBe(true);
  });
});

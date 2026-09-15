import { updatePreferencesSchema } from './preferences.dto';

describe('reading goal preference validation', () => {
  it.each([1, 30, 1440, null])('accepts a goal of %j', (readingGoalMinutes) => {
    expect(updatePreferencesSchema.parse({ readingGoalMinutes })).toEqual({
      readingGoalMinutes,
    });
  });

  it.each([0, -1, 1441, 30.5, '30', '', true])(
    'rejects an invalid goal of %j',
    (readingGoalMinutes) => {
      expect(
        updatePreferencesSchema.safeParse({ readingGoalMinutes }).success,
      ).toBe(false);
    },
  );

  it('allows patches that leave the reading goal unchanged', () => {
    expect(updatePreferencesSchema.parse({ theme: 'dark' })).toEqual({
      theme: 'dark',
    });
  });
});

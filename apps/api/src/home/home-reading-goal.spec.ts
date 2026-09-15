import { createHomeContractFixture } from './home-contract-fixture';

describe('Home reading goal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-03T12:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the current user’s saved goal for today and the displayed week', async () => {
    const { service, prisma, user } = createHomeContractFixture();
    prisma.userPreferences.findUnique.mockResolvedValue({
      readingGoalMinutes: 30,
    });
    prisma.readingSessionSegment.findMany.mockResolvedValue([
      { durationSeconds: 1_800, trackedDay: new Date('2026-09-02T00:00:00Z') },
      { durationSeconds: 1_200, trackedDay: new Date('2026-09-03T00:00:00Z') },
    ]);

    const home = await service.getHome('clerk_1');

    expect(prisma.userPreferences.findUnique).toHaveBeenCalledWith({
      where: { userId: user.id },
      select: { readingGoalMinutes: true },
    });
    expect(home.mastery).toMatchObject({
      dailyGoalMinutes: 30,
      todayMinutes: 20,
      remainingMinutes: 10,
    });
    expect(home.mastery.days.slice(-2)).toEqual([
      { goalMet: true, key: '2026-09-02', minutes: 30 },
      { goalMet: false, key: '2026-09-03', minutes: 20 },
    ]);
  });

  it.each([null, { readingGoalMinutes: null }])(
    'keeps the 60-minute default for preferences %j',
    async (preferences) => {
      const { service, prisma } = createHomeContractFixture();
      prisma.userPreferences.findUnique.mockResolvedValue(preferences);

      const home = await service.getHome('clerk_1');

      expect(home.mastery).toMatchObject({
        dailyGoalMinutes: 60,
        todayMinutes: 0,
        remainingMinutes: 60,
      });
    },
  );
});

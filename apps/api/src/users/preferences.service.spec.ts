import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const getCurrentUserRecord = jest.fn();

  const prisma = {
    userPreferences: { findUnique, upsert },
  };
  const usersService = { getCurrentUserRecord };

  let service: PreferencesService;

  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    getCurrentUserRecord.mockReset();
    service = new PreferencesService(prisma as never, usersService as never);
    getCurrentUserRecord.mockResolvedValue({ id: 'local_user_1' });
  });

  describe('getPreferences', () => {
    it('returns all-null when the user has no preferences row yet', async () => {
      findUnique.mockResolvedValue(null);

      await expect(service.getPreferences('clerk_1')).resolves.toEqual({
        translateTargetLang: null,
        interfaceLang: null,
        theme: null,
        fontScale: null,
        readingGoalMinutes: null,
      });

      expect(findUnique).toHaveBeenCalledWith({
        where: { userId: 'local_user_1' },
      });
    });

    it('serializes the stored row, mapping undefined to null', async () => {
      findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'local_user_1',
        translateTargetLang: 'French',
        interfaceLang: null,
        theme: 'dark',
        fontScale: 1.1,
        readingGoalMinutes: 45,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.getPreferences('clerk_1')).resolves.toEqual({
        translateTargetLang: 'French',
        interfaceLang: null,
        theme: 'dark',
        fontScale: 1.1,
        readingGoalMinutes: 45,
      });
    });
  });

  describe('updatePreferences', () => {
    it('upserts only the fields that are present in the patch', async () => {
      upsert.mockResolvedValue({
        id: 'p1',
        userId: 'local_user_1',
        translateTargetLang: 'German',
        interfaceLang: null,
        theme: null,
        fontScale: null,
        readingGoalMinutes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updatePreferences('clerk_1', {
        translateTargetLang: 'German',
      });

      expect(upsert).toHaveBeenCalledWith({
        where: { userId: 'local_user_1' },
        update: { translateTargetLang: 'German' },
        create: { userId: 'local_user_1', translateTargetLang: 'German' },
      });
    });

    it('forwards explicit nulls to clear a column', async () => {
      upsert.mockResolvedValue({
        id: 'p1',
        userId: 'local_user_1',
        translateTargetLang: null,
        interfaceLang: null,
        theme: null,
        fontScale: null,
        readingGoalMinutes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updatePreferences('clerk_1', {
        translateTargetLang: null,
        theme: null,
      });

      expect(upsert).toHaveBeenCalledWith({
        where: { userId: 'local_user_1' },
        update: { translateTargetLang: null, theme: null },
        create: {
          userId: 'local_user_1',
          translateTargetLang: null,
          theme: null,
        },
      });
    });

    it('omits keys that are undefined so Prisma leaves them untouched', async () => {
      upsert.mockResolvedValue({
        id: 'p1',
        userId: 'local_user_1',
        translateTargetLang: null,
        interfaceLang: null,
        theme: null,
        fontScale: 1.2,
        readingGoalMinutes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updatePreferences('clerk_1', { fontScale: 1.2 });

      expect(upsert).toHaveBeenCalledWith({
        where: { userId: 'local_user_1' },
        update: { fontScale: 1.2 },
        create: { userId: 'local_user_1', fontScale: 1.2 },
      });
    });
  });
});

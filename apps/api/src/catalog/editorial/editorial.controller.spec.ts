import type { UsersService } from '../../users/users.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { EditorialController } from './editorial.controller';
import { catalogEditorialRequest } from './catalog-editorial-request';

jest.mock('./catalog-editorial-request');
const request = { auth: { clerkUserId: 'user' } } as AuthenticatedRequest;
const assertAdmin = jest.fn();
const controller = new EditorialController(
  { assertAdmin } as unknown as UsersService,
  {} as PrismaService,
);
beforeEach(() => {
  jest.clearAllMocks();
});
it('checks the current admin role for reads, edits, author search, review metadata, and deletion', async () => {
  assertAdmin.mockRejectedValue(new Error('Forbidden'));
  for (const operation of [
    () => controller.get(request, 'works', 'id'),
    () => controller.save(request, 'authors', 'id', { isAdmin: true }),
    () => controller.authors(request, 'name'),
    () => controller.reviews(request, 'id'),
    () => controller.remove(request, 'id', { revision: 1 }),
  ]) {
    await expect(operation()).rejects.toThrow('Forbidden');
  }
  expect(catalogEditorialRequest).not.toHaveBeenCalled();
});
it('forwards only the authorized mutation envelope instead of trusting client operations', async () => {
  assertAdmin.mockResolvedValue({ id: 'real-admin' });
  await controller.save(request, 'works', 'id', {
    revision: 4,
    data: { originalTitle: 'Title' },
    operation: 'delete',
    isAdmin: true,
  });
  expect(catalogEditorialRequest).toHaveBeenCalledWith({
    operation: 'save',
    kind: 'works',
    id: 'id',
    revision: 4,
    data: { originalTitle: 'Title' },
  });
});

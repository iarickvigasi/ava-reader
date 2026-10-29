import { EditionWorkController } from './edition-work.controller';
import { linkEditionWork } from './link-edition-work';
import type { UsersService } from '../../users/users.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
jest.mock('./link-edition-work');
it('denies edition reassignment before any Catalog or Main mutation when the user is not admin', async () => {
  const users = {
    assertAdmin: jest.fn().mockRejectedValue(new Error('Forbidden')),
  } as unknown as UsersService;
  const controller = new EditionWorkController(users, {} as PrismaService);
  await expect(
    controller.link(
      { auth: { clerkUserId: 'ordinary' } } as AuthenticatedRequest,
      {} as Parameters<typeof linkEditionWork>[1],
    ),
  ).rejects.toThrow('Forbidden');
  expect(linkEditionWork).not.toHaveBeenCalled();
});

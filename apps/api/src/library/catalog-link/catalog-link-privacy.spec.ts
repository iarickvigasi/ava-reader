import { CatalogLinkController } from './catalog-link.controller';
import { PrivateCatalogLinksController } from './private-catalog-links.controller';
import type { UsersService } from '../../users/users.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
const req = { auth: { clerkUserId: 'admin-clerk' } } as AuthenticatedRequest;
const users = {
  getCurrentUserRecord: jest
    .fn()
    .mockResolvedValue({ id: 'admin-user', roles: ['ADMIN'] }),
} as unknown as UsersService;
it('does not grant an application admin access to another owner’s private link', async () => {
  const findFirst = jest.fn().mockResolvedValue(null);
  const prisma = { libraryItem: { findFirst } } as unknown as PrismaService;
  await expect(
    new CatalogLinkController(prisma, users).get(req, 'someone-elses-copy'),
  ).rejects.toThrow('not found');
  const [query] = findFirst.mock.calls[0] as [
    { where: { userId: string; book: { privateOwnerId: string } } },
  ];
  expect(query.where.userId).toBe('admin-user');
  expect(query.where.book.privateOwnerId).toBe('admin-user');
});
it('lists only the current owner’s links, regardless of admin role', async () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = { libraryItem: { findMany } } as unknown as PrismaService;
  await new PrivateCatalogLinksController(prisma, users).list(req, 'work');
  const [query] = findMany.mock.calls[0] as [
    { where: { userId: string; book: { privateOwnerId: string } } },
  ];
  expect(query.where.userId).toBe('admin-user');
  expect(query.where.book.privateOwnerId).toBe('admin-user');
});

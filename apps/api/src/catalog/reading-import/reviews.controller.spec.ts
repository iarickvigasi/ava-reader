import { ReviewsController } from './reviews.controller';
import { previewImport } from './preview-import';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';

jest.mock('./preview-import');
const assertAdmin = jest.fn();
const db = {} as PrismaService;
const controller = new ReviewsController(db, {
  assertAdmin,
} as unknown as UsersService);
const request = { auth: { clerkUserId: 'user' } } as AuthenticatedRequest;
it('checks admin authorization before granting preview membership', async () => {
  assertAdmin.mockRejectedValueOnce(new Error('Forbidden'));
  await expect(
    controller.preview(request, { editionId: 'edition', checksum: 'hash' }),
  ).rejects.toThrow('Forbidden');
  expect(previewImport).not.toHaveBeenCalled();
});
it('grants preview only for the authenticated admin, never a caller-supplied user ID', async () => {
  assertAdmin.mockResolvedValueOnce({ id: 'real-admin' });
  await controller.preview(request, {
    editionId: 'edition',
    checksum: 'hash',
    userId: 'other-user',
  });
  expect(previewImport).toHaveBeenCalledWith(
    db,
    'real-admin',
    'edition',
    'hash',
  );
});

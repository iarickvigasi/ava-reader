import { ForbiddenException } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { requirePdfReviewer } from './scope';

const cases: [UserRole[], boolean][] = [
  [[], false],
  [['DEVELOPER'], false],
  [['ADMIN'], true],
  [['ADMIN', 'DEVELOPER'], true],
];

it.each(cases)('requires admin membership among %j', async (roles, allowed) => {
  const findUnique = jest.fn().mockResolvedValue({
    roleMemberships: roles.map((role) => ({ role })),
  });
  const result = requirePdfReviewer(
    { user: { findUnique } } as never,
    'reviewer',
  );
  if (allowed) await expect(result).resolves.toBeUndefined();
  else await expect(result).rejects.toBeInstanceOf(ForbiddenException);
  expect(findUnique).toHaveBeenCalledWith({
    where: { id: 'reviewer' },
    select: { roleMemberships: { select: { role: true } } },
  });
});

it('refuses a missing user', async () => {
  const findUnique = jest.fn().mockResolvedValue(null);
  await expect(
    requirePdfReviewer({ user: { findUnique } } as never, 'missing'),
  ).rejects.toBeInstanceOf(ForbiddenException);
});

it('rechecks admin membership after revocation', async () => {
  const findUnique = jest
    .fn()
    .mockResolvedValueOnce({ roleMemberships: [{ role: 'ADMIN' }] })
    .mockResolvedValueOnce({ roleMemberships: [{ role: 'DEVELOPER' }] });
  const prisma = { user: { findUnique } } as never;
  await expect(requirePdfReviewer(prisma, 'reviewer')).resolves.toBeUndefined();
  await expect(requirePdfReviewer(prisma, 'reviewer')).rejects.toBeInstanceOf(
    ForbiddenException,
  );
});

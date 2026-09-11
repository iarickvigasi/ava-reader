import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ClerkAuthService } from '../../auth/clerk-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { CollectionMembershipController } from './collection-membership.controller';
import { membershipTestFixture } from './membership-test-fixture';

describe('collection membership endpoint', () => {
  let app: INestApplication<App>;
  const user = jest.fn().mockResolvedValue({ id: 'user' });

  beforeEach(async () => {
    const { options } = membershipTestFixture();
    const module = await Test.createTestingModule({
      controllers: [CollectionMembershipController],
      providers: [
        { provide: PrismaService, useValue: options.prisma },
        { provide: UsersService, useValue: { getCurrentUserRecord: user } },
        {
          provide: ClerkAuthService,
          useValue: {
            authenticateSessionToken: jest
              .fn()
              .mockResolvedValue({ clerkUserId: 'clerk-user' }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    user.mockClear();
  });

  afterEach(async () => app.close());

  it('rejects a request without a bearer token', async () => {
    await request(app.getHttpServer())
      .patch('/api/library/book/collections')
      .send({ addCollectionIds: [], removeCollectionIds: [] })
      .expect(401);
    expect(user).not.toHaveBeenCalled();
  });

  it('uses the authenticated owner and returns the membership snapshot', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/library/book/collections')
      .set('Authorization', 'Bearer token')
      .send({ addCollectionIds: ['added'], removeCollectionIds: ['removed'] })
      .expect(200);
    expect(user).toHaveBeenCalledWith('clerk-user');
    expect(response.body as unknown).toMatchObject({
      libraryItemId: 'book',
      affectedCollections: [
        { id: 'added', itemCount: 6 },
        { id: 'removed', itemCount: 0 },
      ],
    });
  });

  it('returns a machine-readable error for smart membership changes', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/library/book/collections')
      .set('Authorization', 'Bearer token')
      .send({ addCollectionIds: [], removeCollectionIds: ['smart'] })
      .expect(403);
    expect(response.body as unknown).toMatchObject({
      code: 'smartCollectionReadOnly',
    });
  });
});

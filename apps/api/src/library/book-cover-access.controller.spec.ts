import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ClerkAuthService } from '../auth/clerk-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

describe('cover ownership at the HTTP boundary', () => {
  let app: INestApplication<App>;
  const findFirst = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LibraryController],
      providers: [
        LibraryService,
        { provide: PrismaService, useValue: { book: { findFirst } } },
        {
          provide: UsersService,
          useValue: {
            getCurrentUserRecord: (id: string) => Promise.resolve({ id }),
          },
        },
        {
          provide: ClerkAuthService,
          useValue: {
            authenticateSessionToken: (token: string) =>
              Promise.resolve({
                clerkUserId: token,
              }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    findFirst.mockReset().mockImplementation(
      ({
        where,
      }: {
        where: {
          id: string;
          libraryItems?: { some: { user: { clerkUserId: string } } };
        };
      }) =>
        where.id === 'private-book' &&
        where.libraryItems?.some.user.clerkUserId === 'owner'
          ? {
              coverBlob: {
                bytes: Buffer.from('private artwork'),
                mimeType: 'image/jpeg',
              },
            }
          : null,
    );
  });
  it('rejects anonymous access before reading any book data', async () => {
    await request(app.getHttpServer())
      .get('/api/library/covers/private-book')
      .expect(401);
    expect(findFirst).not.toHaveBeenCalled();
  });
  it('returns 404 to another signed-in user who knows the book ID', async () => {
    await request(app.getHttpServer())
      .get('/api/library/covers/private-book')
      .set('Authorization', 'Bearer other')
      .expect(404);
  });
  it('allows the owner and forbids shared HTTP caching', async () => {
    await request(app.getHttpServer())
      .get('/api/library/covers/private-book')
      .set('Authorization', 'Bearer owner')
      .expect(200)
      .expect('Cache-Control', 'private, no-store')
      .expect('Content-Type', /image\/jpeg/);
  });
});

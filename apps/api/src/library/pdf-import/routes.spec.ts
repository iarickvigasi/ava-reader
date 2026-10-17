import type { Server } from 'node:http';
import { INestApplication, type Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { PdfImportController } from './pdf-import.controller';
import { PdfNotificationsController } from './pdf-notifications.controller';

const originalStatus = Object.getOwnPropertyDescriptor(
  PdfImportController.prototype,
  'status',
)!.value as object;
const originalList = Object.getOwnPropertyDescriptor(
  PdfNotificationsController.prototype,
  'list',
)!.value as object;

describe('PDF routes in actual AppModule registration order', () => {
  let app: INestApplication;
  const status = jest.spyOn(PdfImportController.prototype, 'status');
  const notices = jest.spyOn(PdfNotificationsController.prototype, 'list');
  beforeAll(async () => {
    // Spies replace functions; preserve actual Nest route/parameter metadata.
    for (const [original, spy] of [
      [originalStatus, status],
      [originalList, notices],
    ]) {
      for (const key of Reflect.getMetadataKeys(original) as string[])
        Reflect.defineMetadata(
          key,
          Reflect.getMetadata(key, original) as unknown,
          spy,
        );
    }
    const controllers = (
      Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        AppModule,
      ) as Type<unknown>[]
    ).filter(
      (type) =>
        type === PdfImportController || type === PdfNotificationsController,
    );
    status.mockResolvedValue({ route: 'status' } as never);
    notices.mockResolvedValue({ notifications: [], complete: true });
    const module = await Test.createTestingModule({
      controllers,
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });
  it('dispatches notifications to its static route rather than an operation named notifications', async () => {
    await request(app.getHttpServer() as Server)
      .get('/library/pdf-imports/notifications')
      .expect(200)
      .expect({ notifications: [], complete: true });
    expect(status).not.toHaveBeenCalled();
  });
  it('retains the owned operation status route', async () => {
    await request(app.getHttpServer() as Server)
      .get('/library/pdf-imports/operation-123')
      .expect(200)
      .expect({ route: 'status' });
  });
});

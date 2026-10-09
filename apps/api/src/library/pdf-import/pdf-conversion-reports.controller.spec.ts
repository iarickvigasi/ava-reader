import type { Server } from 'node:http';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PdfConversionReportsController } from './pdf-conversion-reports.controller';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { projectConversionCost } from './reports/cost-projection';

describe('registered conversion report HTTP boundary', () => {
  let app: INestApplication;
  const user = { findUnique: jest.fn() };
  const tx = {
    pdfConversionInvestigation: { findUnique: jest.fn() },
    pdfConversionCost: { findUnique: jest.fn() },
    pdfProviderGrant: { findUnique: jest.fn() },
  };
  const transaction = jest.fn((work: (value: typeof tx) => unknown) =>
    Promise.resolve(work(tx)),
  );
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PdfConversionReportsController],
      providers: [
        {
          provide: PrismaService,
          useValue: { user, $transaction: transaction },
        },
        {
          provide: UsersService,
          useValue: {
            assertAdmin: jest.fn().mockResolvedValue({ id: 'admin' }),
          },
        },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { auth: unknown } };
        }) => {
          context.switchToHttp().getRequest().auth = {
            clerkUserId: 'synthetic-clerk',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    user.findUnique
      .mockReset()
      .mockResolvedValue({ roleMemberships: [{ role: 'ADMIN' }] });
    tx.pdfConversionInvestigation.findUnique.mockResolvedValue({
      id: 'conversion',
      operationKey: null,
      coverage: 'API_LIFECYCLE',
      status: 'REFUSED',
      activeAdmissionCount: 0,
    });
    const projection = projectConversionCost([], true);
    tx.pdfConversionCost.findUnique.mockResolvedValue({
      ...projection,
      knownActualNano: 0n,
      reservedNano: 0n,
      uncertainNano: 0n,
      reconciledAt: new Date(),
    });
    tx.pdfProviderGrant.findUnique.mockResolvedValue(null);
  });
  afterAll(async () => {
    await app.close();
  });
  it('serves independent cost under the ADMIN route with no-store and fresh membership checks', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/admin/pdf-conversion-reports/conversion/cost')
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toMatchObject({
      conversionId: 'conversion',
      knownActualNano: '0',
      state: 'FINAL',
      callCount: 0,
    });
    expect(user.findUnique).toHaveBeenCalledTimes(2);
  });
  it('denies an ordinary reader before reading another owner’s report', async () => {
    user.findUnique.mockResolvedValue({ roleMemberships: [] });
    await request(app.getHttpServer() as Server)
      .get('/admin/pdf-conversion-reports/conversion/cost')
      .expect(403);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('denies delivery when ADMIN membership is revoked during the read', async () => {
    user.findUnique
      .mockResolvedValueOnce({ roleMemberships: [{ role: 'ADMIN' }] })
      .mockResolvedValueOnce({ roleMemberships: [] });
    const response = await request(app.getHttpServer() as Server)
      .get('/admin/pdf-conversion-reports/conversion/cost')
      .expect(403);
    expect(response.body).not.toHaveProperty('knownActualNano');
  });
  it('rejects an arbitrary lookup field before any asynchronous report query', async () => {
    await request(app.getHttpServer() as Server)
      .get('/admin/pdf-conversion-reports/lookup?path=PRIVATE_PATH_CANARY')
      .expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });
});

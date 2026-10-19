import type { PrismaClient } from '@prisma/client';
import { registerPdfRoute } from './register-route';
import { config, tariff } from './test-fixtures';

it.each(['google-vertex/global', 'google-vertex/global/priority'])(
  'registers the same endpoint identifier %s accepted by the report contract',
  async (providerSlug) => {
    const prior = process.env.AVA_PDF_TEST_HOOKS;
    process.env.AVA_PDF_TEST_HOOKS = '1';
    const create = jest.fn(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'route-one', ...data }),
    );
    try {
      await expect(
        registerPdfRoute(
          { pdfProviderRoute: { create } } as unknown as PrismaClient,
          {
            accountKey: 'test',
            modelId: 'google/gemini-3.8-flash',
            providerSlug,
            mode: 'stub',
            configuration: config,
            tariff,
            verifiedAt: '2026-10-12T16:00:00.000Z',
            validUntil: '2026-10-12T17:00:00.000Z',
          },
        ),
      ).resolves.toMatchObject({ routeId: 'route-one' });
      expect(create.mock.calls[0][0].data.providerSlug).toBe(providerSlug);
    } finally {
      if (prior === undefined) delete process.env.AVA_PDF_TEST_HOOKS;
      else process.env.AVA_PDF_TEST_HOOKS = prior;
    }
  },
);
it.each([
  'https://private.example/path',
  'Bearer-private',
  'sk-secret',
  'provider//endpoint',
  'provider/sk-secret',
  'provider/Bearer-private',
])(
  'refuses unsafe endpoint %s before a route can be registered',
  async (providerSlug) => {
    const prior = process.env.AVA_PDF_TEST_HOOKS;
    process.env.AVA_PDF_TEST_HOOKS = '1';
    const create = jest.fn();
    try {
      await expect(
        registerPdfRoute(
          { pdfProviderRoute: { create } } as unknown as PrismaClient,
          {
            accountKey: 'test',
            modelId: 'model',
            providerSlug,
            mode: 'stub',
            configuration: config,
            tariff,
            verifiedAt: '2026-10-12T16:00:00.000Z',
            validUntil: '2026-10-12T17:00:00.000Z',
          },
        ),
      ).rejects.toThrow('PDF_PROVIDER_ROUTE_INVALID');
      expect(create).not.toHaveBeenCalled();
    } finally {
      if (prior === undefined) delete process.env.AVA_PDF_TEST_HOOKS;
      else process.env.AVA_PDF_TEST_HOOKS = prior;
    }
  },
);

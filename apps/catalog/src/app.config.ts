import type { INestApplication } from '@nestjs/common';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CATALOG_WEB_ORIGIN ?? 'http://localhost:3000').split(
      ',',
    ),
  });
  app.enableShutdownHooks();
}

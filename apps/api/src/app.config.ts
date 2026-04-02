import { INestApplication } from '@nestjs/common';

export function configureApp(app: INestApplication) {
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: webOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}

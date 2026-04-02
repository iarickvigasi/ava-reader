import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      datasourceUrl:
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/ava_reader?schema=public',
    });
  }
}

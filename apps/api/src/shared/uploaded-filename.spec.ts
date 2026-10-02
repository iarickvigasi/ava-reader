import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { createHash } from 'node:crypto';
import { LibraryController } from '../library/library.controller';
import { LibraryService } from '../library/library.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { withUploadedFilename } from './uploaded-filename';

const bytes = Buffer.from('%PDF-unchanged-source');
const digest = (value: Buffer) =>
  createHash('sha256').update(value).digest('hex');

describe('Unicode multipart import filenames', () => {
  let app: INestApplication;
  const importBook = jest.fn((_owner: string, file: Express.Multer.File) => ({
    filename: file.originalname,
    digest: digest(file.buffer),
  }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LibraryController],
      providers: [{ provide: LibraryService, useValue: { importBook } }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { auth: unknown } };
        }) => {
          context.switchToHttp().getRequest().auth = {
            clerkUserId: 'fixture-owner',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => importBook.mockClear());

  it.each(['Жінки ґрунт ї є.epub', 'Ã© literal.epub'])(
    'preserves %s through the actual multipart endpoint',
    async (filename) => {
      const result = await request(app.getHttpServer() as Server)
        .post('/library/import')
        .attach('file', bytes, {
          filename,
          contentType: 'application/epub+zip',
        })
        .field('originalFilename', filename)
        .expect(201);
      expect(result.body).toEqual({ filename, digest: digest(bytes) });
      expect(importBook).toHaveBeenCalledTimes(1);
    },
  );

  it('retains compatibility for clients without the new text field', async () => {
    const result = await request(app.getHttpServer() as Server)
      .post('/library/import')
      .attach('file', bytes, 'legacy.epub')
      .expect(201);
    expect(result.body).toEqual({
      filename: 'legacy.epub',
      digest: digest(bytes),
    });
  });

  it.each(['', 'a\n.epub', 'a'.repeat(256)])(
    'rejects invalid names before import',
    async (filename) => {
      await request(app.getHttpServer() as Server)
        .post('/library/import')
        .attach('file', bytes, 'valid.epub')
        .field('originalFilename', filename)
        .expect(400);
      expect(importBook).not.toHaveBeenCalled();
    },
  );

  it('rejects repeated filename fields', async () => {
    await request(app.getHttpServer() as Server)
      .post('/library/import')
      .attach('file', bytes, 'valid.epub')
      .field('originalFilename', 'one.epub')
      .field('originalFilename', 'two.epub')
      .expect(400);
    expect(importBook).not.toHaveBeenCalled();
  });

  it('does not mutate the parser file or its bytes', () => {
    const file = {
      originalname: 'parser-name',
      buffer: bytes,
    } as Express.Multer.File;
    const result = withUploadedFilename(file, 'Книга.pdf');
    expect(file.originalname).toBe('parser-name');
    expect(result.buffer).toBe(bytes);
    expect(result.originalname).toBe('Книга.pdf');
  });
});

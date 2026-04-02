import { extname } from 'path';
import { BookFileFormat } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import mime from 'mime-types';
import { titleFromFilename } from './blob-utils';

type UploadedFileLike = {
  buffer: Buffer;
  mimetype?: string;
  originalname: string;
};

export type ExtractedBookMetadata = {
  author: string | null;
  description: string | null;
  format: BookFileFormat;
  language: string | null;
  publishedYear: number | null;
  title: string;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  trimValues: true,
});

export async function extractBookMetadata(
  file: UploadedFileLike,
): Promise<ExtractedBookMetadata> {
  const format = detectBookFileFormat(file);
  const fallbackTitle = titleFromFilename(file.originalname);

  if (format === BookFileFormat.EPUB) {
    const epubMetadata = await tryExtractEpubMetadata(file.buffer);

    return {
      author: epubMetadata.author ?? null,
      description: epubMetadata.description ?? null,
      format,
      language: epubMetadata.language ?? null,
      publishedYear: epubMetadata.publishedYear ?? null,
      title: epubMetadata.title ?? fallbackTitle,
    };
  }

  return {
    author: null,
    description: null,
    format,
    language: null,
    publishedYear: null,
    title: fallbackTitle,
  };
}

export function detectBookFileFormat(file: UploadedFileLike) {
  const mimeType = file.mimetype ?? mime.lookup(file.originalname) ?? '';
  const extension = extname(file.originalname).toLowerCase();

  if (mimeType === 'application/epub+zip' || extension === '.epub') {
    return BookFileFormat.EPUB;
  }

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    return BookFileFormat.PDF;
  }

  return BookFileFormat.UNKNOWN;
}

export function isSupportedSourceFormat(
  format: BookFileFormat | null,
): format is 'EPUB' | 'PDF' {
  return format === BookFileFormat.EPUB || format === BookFileFormat.PDF;
}

async function tryExtractEpubMetadata(buffer: Buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const containerFile = zip.file('META-INF/container.xml');

    if (!containerFile) {
      return {};
    }

    const containerXml = await containerFile.async('text');
    const container = xmlParser.parse(containerXml) as {
      container?: {
        rootfiles?: {
          rootfile?:
            | { ['@_full-path']?: string }
            | Array<{ ['@_full-path']?: string }>;
        };
      };
    };
    const rootfile = firstAsArray(container.container?.rootfiles?.rootfile)[0];
    const packagePath = rootfile?.['@_full-path'];

    if (!packagePath) {
      return {};
    }

    const packageFile = zip.file(packagePath);

    if (!packageFile) {
      return {};
    }

    const packageXml = await packageFile.async('text');
    const packageDocument = xmlParser.parse(packageXml) as {
      package?: {
        metadata?: Record<string, unknown>;
      };
    };
    const metadata = packageDocument.package?.metadata;

    return {
      author: readMetadataText(metadata, ['dc:creator', 'creator']),
      description: readMetadataText(metadata, [
        'dc:description',
        'description',
      ]),
      language: readMetadataText(metadata, ['dc:language', 'language']),
      publishedYear: readPublishedYear(
        readMetadataText(metadata, ['dc:date', 'date']),
      ),
      title: readMetadataText(metadata, ['dc:title', 'title']),
    };
  } catch {
    return {};
  }
}

function readPublishedYear(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{4}/);

  return match ? Number(match[0]) : null;
}

function readMetadataText(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
) {
  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const entry = metadata[key];
    const text = normalizeXmlText(entry);

    if (text) {
      return text;
    }
  }

  return null;
}

function normalizeXmlText(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = normalizeXmlText(entry);

      if (text) {
        return text;
      }
    }

    return null;
  }

  if (typeof value === 'object') {
    const maybeText = (value as Record<string, unknown>)['#text'];

    if (typeof maybeText === 'string' && maybeText.trim().length > 0) {
      return maybeText.trim();
    }
  }

  return null;
}

function firstAsArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

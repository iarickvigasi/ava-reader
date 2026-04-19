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
type EpubCreator = {
  role: null | string;
  text: string;
};

export type ExtractedBookMetadata = {
  authors: string[];
  coverImage: {
    bytes: Buffer;
    mimeType: string;
    originalFilename: string;
  } | null;
  description: string | null;
  format: BookFileFormat;
  genres: string[];
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
      authors: epubMetadata.authors ?? [],
      coverImage: epubMetadata.coverImage ?? null,
      description: epubMetadata.description ?? null,
      format,
      genres: epubMetadata.genres ?? [],
      language: epubMetadata.language ?? null,
      publishedYear: epubMetadata.publishedYear ?? null,
      title: epubMetadata.title ?? fallbackTitle,
    };
  }

  return {
    authors: [],
    coverImage: null,
    description: null,
    format,
    genres: [],
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
        manifest?: {
          item?: Record<string, string> | Array<Record<string, string>>;
        };
        metadata?: Record<string, unknown>;
      };
    };
    const metadata = packageDocument.package?.metadata;
    const manifestItems = firstAsArray(packageDocument.package?.manifest?.item);
    const coverImagePath = readEpubCoverPath(metadata, manifestItems);
    const coverImage = coverImagePath
      ? await readZipBinaryAsset(zip, packagePath, coverImagePath)
      : null;

    return {
      authors: readEpubAuthors(metadata, ['dc:creator', 'creator']),
      coverImage,
      description: readMetadataText(metadata, [
        'dc:description',
        'description',
      ]),
      genres: readMetadataGenres(metadata, ['dc:subject', 'subject']),
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

function readEpubCoverPath(
  metadata: Record<string, unknown> | undefined,
  manifestItems: Array<Record<string, string>>,
) {
  const manifestCoverId = readCoverIdFromMeta(metadata);

  if (manifestCoverId) {
    const manifestCover = manifestItems.find(
      (item) => item['@_id'] === manifestCoverId,
    );

    if (manifestCover?.['@_href']) {
      return manifestCover['@_href'];
    }
  }

  const propertiesCover = manifestItems.find((item) =>
    item['@_properties']?.split(/\s+/).includes('cover-image'),
  );

  if (propertiesCover?.['@_href']) {
    return propertiesCover['@_href'];
  }

  return null;
}

function readCoverIdFromMeta(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return null;
  }

  const metaEntries = firstAsArray(metadata.meta);

  for (const entry of metaEntries) {
    if (
      entry &&
      typeof entry === 'object' &&
      (entry as Record<string, string>)['@_name'] === 'cover'
    ) {
      const content = (entry as Record<string, string>)['@_content'];

      if (content.trim().length > 0) {
        return content.trim();
      }
    }
  }

  return null;
}

async function readZipBinaryAsset(
  zip: JSZip,
  packagePath: string,
  relativeAssetPath: string,
) {
  const assetPath = resolveZipPath(packagePath, relativeAssetPath);
  const assetFile = zip.file(assetPath);

  if (!assetFile) {
    return null;
  }

  const bytes = await assetFile.async('nodebuffer');
  const mimeType = mime.lookup(assetPath) || 'application/octet-stream';

  return {
    bytes,
    mimeType,
    originalFilename: assetPath.split('/').at(-1) ?? 'cover',
  };
}

function resolveZipPath(baseFilePath: string, relativeAssetPath: string) {
  const baseSegments = baseFilePath.split('/').slice(0, -1);
  const assetSegments = relativeAssetPath.split('/');
  const resolved = [...baseSegments];

  for (const segment of assetSegments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      resolved.pop();
      continue;
    }

    resolved.push(segment);
  }

  return resolved.join('/');
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
  return readMetadataTexts(metadata, keys)[0] ?? null;
}

function readMetadataTexts(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
) {
  if (!metadata) {
    return [];
  }

  const values: string[] = [];

  for (const key of keys) {
    const entry = metadata[key];
    values.push(...normalizeXmlTexts(entry));
  }

  return values;
}

function readEpubAuthors(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
) {
  const creators = readMetadataCreators(metadata, keys);
  const creatorsWithAuthorRole = creators.filter(
    (creator) => normalizeCreatorRole(creator.role) === 'aut',
  );
  const selectedCreators =
    creatorsWithAuthorRole.length > 0 ? creatorsWithAuthorRole : creators;

  return dedupeTextsPreserveOrder(
    selectedCreators.map((creator) => creator.text),
  );
}

function readMetadataCreators(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): EpubCreator[] {
  if (!metadata) {
    return [];
  }

  const creators: EpubCreator[] = [];

  for (const key of keys) {
    const entry = metadata[key];
    creators.push(...normalizeXmlCreatorEntries(entry));
  }

  return creators;
}

function normalizeXmlCreatorEntries(value: unknown): EpubCreator[] {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    return trimmed.length > 0 ? [{ role: null, text: trimmed }] : [];
  }

  if (Array.isArray(value)) {
    const creators: EpubCreator[] = [];

    for (const entry of value) {
      creators.push(...normalizeXmlCreatorEntries(entry));
    }

    return creators;
  }

  if (typeof value === 'object') {
    const creatorRecord = value as Record<string, unknown>;
    const textValue = normalizeXmlTexts(creatorRecord['#text'])[0] ?? null;

    if (!textValue) {
      return [];
    }

    const roleRaw =
      creatorRecord['@_opf:role'] ??
      creatorRecord['@_role'] ??
      creatorRecord['@_opf:ROLE'] ??
      creatorRecord['@_ROLE'];

    return [
      {
        role: typeof roleRaw === 'string' ? roleRaw : null,
        text: textValue,
      },
    ];
  }

  return [];
}

function readMetadataGenres(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
) {
  const values = readMetadataTexts(metadata, keys).flatMap(splitGenreTokens);

  return dedupeGenresPreserveOrder(values);
}

function normalizeCreatorRole(role: string | null) {
  if (!role) {
    return null;
  }

  const normalized = role.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeXmlTexts(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    const values: string[] = [];

    for (const entry of value) {
      values.push(...normalizeXmlTexts(entry));
    }

    return values;
  }

  if (typeof value === 'object') {
    const maybeText = (value as Record<string, unknown>)['#text'];

    return normalizeXmlTexts(maybeText);
  }

  return [];
}

function dedupeGenresPreserveOrder(values: string[]) {
  return dedupeTextsPreserveOrder(values);
}

function dedupeTextsPreserveOrder(values: string[]) {
  const uniqueValues: string[] = [];
  const seenValues = new Set<string>();

  for (const value of values) {
    const normalizedValue = value.toLocaleLowerCase();

    if (seenValues.has(normalizedValue)) {
      continue;
    }

    seenValues.add(normalizedValue);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function splitGenreTokens(value: string) {
  return value
    .split(/\s+(?:--|-)\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function firstAsArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

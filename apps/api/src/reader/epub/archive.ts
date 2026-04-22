import { extname } from 'path';
import JSZip from 'jszip';
import mime from 'mime-types';
import { resolveZipPath } from '../../shared/zip-utils';
import { xmlParser, firstAsArray } from './xml-utils';

export async function readZipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);

  if (!file) {
    throw new Error(`The EPUB is missing ${path}.`);
  }

  return file.async('text');
}

export async function readPackagePath(zip: JSZip): Promise<string> {
  const containerXml = await readZipText(zip, 'META-INF/container.xml');
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
    throw new Error('The EPUB container does not point to a package document.');
  }

  return packagePath;
}

export async function readEpubAssetAsDataUrl(
  zip: JSZip,
  packagePath: string,
  chapterHref: string,
  assetPath: string,
): Promise<string | null> {
  const chapterPath = resolveZipPath(packagePath, chapterHref);
  const resolvedPath = resolveZipPath(chapterPath, assetPath);
  const assetFile = zip.file(resolvedPath);

  if (!assetFile) {
    return null;
  }

  const bytes = await assetFile.async('nodebuffer');
  const mimeType =
    mime.lookup(resolvedPath) || inferMimeTypeFromPath(resolvedPath);
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

export function inferMimeTypeFromPath(path: string): string {
  const extension = extname(path).toLowerCase();

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }

  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.gif') {
    return 'image/gif';
  }

  if (extension === '.svg') {
    return 'image/svg+xml';
  }

  return 'application/octet-stream';
}

export function normalizeArchivePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '');
}

export function normalizeArchiveLookupPath(path: string): string {
  return normalizeArchivePath(path).toLowerCase();
}

export function dirnameOfZipPath(path: string): string {
  const normalizedPath = normalizeArchivePath(path);
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  return lastSlashIndex === -1 ? '' : normalizedPath.slice(0, lastSlashIndex);
}

export function toPackageRelativeHref(
  archivePath: string,
  packageDirectory: string,
): string {
  const normalizedPath = normalizeArchivePath(archivePath);

  if (packageDirectory && normalizedPath.startsWith(`${packageDirectory}/`)) {
    return normalizedPath.slice(packageDirectory.length + 1);
  }

  return normalizedPath;
}

export function hasReadableDocumentExtension(path: string): boolean {
  const extension = extname(path).toLowerCase();
  return (
    extension === '.xhtml' ||
    extension === '.html' ||
    extension === '.htm' ||
    extension === '.xml'
  );
}

export function normalizeHrefForLookup(href: string): string {
  return decodeURIComponent(href.split('#')[0] ?? href).toLowerCase();
}

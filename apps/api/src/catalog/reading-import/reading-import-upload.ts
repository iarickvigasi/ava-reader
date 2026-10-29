import { MAX_IMPORT_BYTES } from './manifest';
export const readingImportUpload = {
  limits: {
    fileSize: MAX_IMPORT_BYTES,
    files: 1,
    fields: 1,
    fieldSize: 6 * 1024 * 1024,
  },
};

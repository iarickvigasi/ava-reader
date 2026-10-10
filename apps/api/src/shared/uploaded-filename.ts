import { BadRequestException } from '@nestjs/common';

// Multipart filename headers may be decoded as Latin-1 by the upload parser.
// A UTF-8 text field carries the browser's original name without guessing encoding.
export function withUploadedFilename(
  file: Express.Multer.File,
  originalFilename: unknown,
): Express.Multer.File {
  if (originalFilename === undefined) return file;
  if (
    typeof originalFilename !== 'string' ||
    !originalFilename.trim() ||
    originalFilename.length > 255 ||
    Array.from(originalFilename).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    throw new BadRequestException('Invalid original filename');
  }
  if (!file) return file; // Existing upload validation owns missing-file errors.
  return { ...file, originalname: originalFilename };
}

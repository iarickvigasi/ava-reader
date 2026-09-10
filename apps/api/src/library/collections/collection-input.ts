import { BadRequestException } from '@nestjs/common';

export function normalizeCollectionText(value: string) {
  return value.trim().replace(/\p{L}/u, (letter) => letter.toUpperCase());
}

export function validateCollectionInput(input: {
  name?: unknown;
  description?: unknown;
}) {
  if (typeof input?.name !== 'string' || !input.name.trim()) {
    throw new BadRequestException({
      code: 'nameEmpty',
      message: 'Collection name is required.',
    });
  }
  const name = normalizeCollectionText(input.name);
  if (name.length > 100) {
    throw new BadRequestException({
      code: 'nameTooLong',
      message: 'Collection title must be 100 characters or fewer.',
    });
  }
  if (input.description != null && typeof input.description !== 'string') {
    throw new BadRequestException({
      code: 'descriptionInvalid',
      message: 'Description must be text.',
    });
  }
  const description =
    typeof input.description === 'string'
      ? normalizeCollectionText(input.description) || null
      : null;
  if (description && description.length > 1000) {
    throw new BadRequestException({
      code: 'descriptionTooLong',
      message: 'Description must be 1,000 characters or fewer.',
    });
  }
  return { name, description };
}

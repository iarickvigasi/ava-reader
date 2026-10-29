import { BadRequestException } from '@nestjs/common';
import type { EditorialRequest } from './types';

export function parseEditorial(value: unknown): EditorialRequest {
  if (!value || typeof value !== 'object')
    throw new BadRequestException('Invalid operation');
  const request = value as EditorialRequest;
  if (request.operation === 'search') {
    if (
      request.kind !== 'authors' ||
      typeof request.query !== 'string' ||
      request.query.length > 100
    )
      throw new BadRequestException('Invalid search');
    return request;
  }
  if (
    !['get', 'save', 'delete'].includes(request.operation) ||
    !['works', 'authors', 'editions'].includes(request.kind) ||
    !/^[a-f\d-]{36}$/i.test(request.id ?? '') ||
    (request.operation !== 'get' &&
      (!Number.isInteger(request.revision) || request.revision! < 1)) ||
    (request.operation === 'delete' && request.kind !== 'works')
  )
    throw new BadRequestException('Invalid editorial operation');
  return request;
}

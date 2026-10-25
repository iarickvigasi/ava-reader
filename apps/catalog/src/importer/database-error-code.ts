// Prisma can wrap PostgreSQL codes in adapter causes or request metadata.
export function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return;
  const value = error as Record<string, unknown>;
  for (const key of ['originalCode', 'code']) {
    if (typeof value[key] === 'string' && /^\d[A-Z\d]{4}$/.test(value[key]))
      return value[key];
  }
  for (const key of ['cause', 'meta', 'driverAdapterError']) {
    const code = databaseErrorCode(value[key]);
    if (code) return code;
  }
}

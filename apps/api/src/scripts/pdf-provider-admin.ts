import { PrismaService } from '../prisma/prisma.service';
import { runPdfProviderAdmin } from '../library/pdf-import/providers/admin-command';
import { PdfProviderError } from '../library/pdf-import/providers/errors';
async function main() {
  if (!process.env.DATABASE_URL)
    throw new PdfProviderError('PDF_PROVIDER_DATABASE_REQUIRED');
  const prisma = new PrismaService();
  try {
    const result = await runPdfProviderAdmin(prisma, process.argv.slice(2));
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  process.stderr.write(
    JSON.stringify({
      code:
        error instanceof PdfProviderError
          ? error.code
          : 'PDF_PROVIDER_ADMIN_FAILED',
    }) + '\n',
  );
  process.exitCode = 1;
});

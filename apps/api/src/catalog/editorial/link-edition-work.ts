import { catalogEditorialRequest } from './catalog-editorial-request';
import type { PrismaService } from '../../prisma/prisma.service';
export async function linkEditionWork(
  prisma: PrismaService,
  body: {
    editionId: string;
    workId: string;
    revision: number;
    workRevision: number;
  },
) {
  const result = await catalogEditorialRequest(body, 'edition-work');
  // Repair public review pointers only. Private links belong exclusively to their owners.
  await prisma.$executeRaw`UPDATE "CatalogEntry" SET "importEvidence" = jsonb_set("importEvidence", '{workId}', to_jsonb(${body.workId}::text)), "importSyncPending" = true, "importSyncRevision" = "importSyncRevision" + 1 WHERE "importKey" IS NOT NULL AND "importEvidence"->>'editionId' = ${body.editionId}`;
  return result;
}

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { buildCollectionSlugBase } from '../shared/collection-slug';
import { resolveUniqueSlug } from '../shared/slugify';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/ava_reader?schema=public',
});
const prisma = new PrismaClient({ adapter });

// Replaces cuid-shaped slugs (the backfill default from the slug migration)
// with transliterated slugs derived from each collection's name. Safe to
// re-run — rows whose slug already differs from their id are left alone.
async function main() {
  const collections = await prisma.collection.findMany({
    select: { id: true, userId: true, name: true, slug: true },
  });

  let updated = 0;

  for (const collection of collections) {
    if (collection.slug !== collection.id) {
      continue;
    }

    const baseSlug = buildCollectionSlugBase({ name: collection.name });
    const slug = await resolveUniqueSlug(baseSlug, async (candidate) => {
      const conflict = await prisma.collection.findUnique({
        where: { userId_slug: { userId: collection.userId, slug: candidate } },
        select: { id: true },
      });
      return conflict !== null && conflict.id !== collection.id;
    });

    await prisma.collection.update({
      where: { id: collection.id },
      data: { slug },
    });

    updated += 1;
    console.log(`${collection.id} → ${slug}`);
  }

  console.log(`Backfilled ${updated} of ${collections.length} collections.`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

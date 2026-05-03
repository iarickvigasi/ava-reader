import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { buildBookSlugBase, resolveUniqueBookSlug } from '../shared/book-slug';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/ava_reader?schema=public',
});
const prisma = new PrismaClient({ adapter });

// Replaces cuid-shaped slugs (the backfill default from the slug migration) with
// transliterated `{title}-by-{author}` slugs. Safe to re-run — rows whose slug
// already differs from their id are left alone.
async function main() {
  const items = await prisma.libraryItem.findMany({
    include: {
      book: { select: { title: true, authors: true } },
    },
  });

  let updated = 0;

  for (const item of items) {
    if (item.slug !== item.id) {
      continue;
    }

    const baseSlug = buildBookSlugBase({
      title: item.book.title,
      authors: item.book.authors,
    });
    const slug = await resolveUniqueBookSlug(baseSlug, async (candidate) => {
      const conflict = await prisma.libraryItem.findUnique({
        where: { userId_slug: { userId: item.userId, slug: candidate } },
        select: { id: true },
      });
      return conflict !== null && conflict.id !== item.id;
    });

    await prisma.libraryItem.update({
      where: { id: item.id },
      data: { slug },
    });

    updated += 1;
    console.log(`${item.id} → ${slug}`);
  }

  console.log(`Backfilled ${updated} of ${items.length} library items.`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

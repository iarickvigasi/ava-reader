import { WORK_COVER_SELECT } from './work-cover-select';
import type { Prisma } from '#catalog-client';

export const WORK_CARD_SELECT = {
  ...WORK_COVER_SELECT,
  categories: true,
  id: true,
  originalTitle: true,
  originalLanguage: true,
  revision: true,
  texts: { select: { locale: true, title: true } },
  credits: {
    orderBy: [{ position: 'asc' }, { authorId: 'asc' }],
    include: { author: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.WorkSelect;
